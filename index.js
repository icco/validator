const createScheduler = require('probot-scheduler')

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Application} app
 */
module.exports = app => {
  createScheduler(app)
  app.on(['check_suite.requested', 'check_run.rerequested'], check)
  app.on('schedule.repository', context => {
    let license = loadLicense(context)
    if (license != null) {
      return
    }

    let title = "Repo needs a LICENSE"
    let description = "This repo is missing a license file according to the Github API. Please add one."
    let issue = findIssue(context, title)

    if (issue == null) {
      octokit.issues.create(contex.repo({
        title,
        description,
      }));
    }
  })

  async function check (context) {
    const startTime = new Date()
    const { head_branch: headBranch, head_sha: headSha } = context.payload.check_suite

    return context.github.checks.create(context.repo({
      name: 'Nat Validator',
      head_branch: headBranch,
      head_sha: headSha,
      status: 'completed',
      started_at: startTime,
      conclusion: 'success',
      completed_at: new Date(),
      output: {
        title: 'Validate PR',
        summary: 'The check has passed!',
      }
    }))
  }
}

async function loadLicense(context) {
  try {
    const resp = await context.github.licenses.getForRepo(context.repo({}));
    return response.data.content;
  } catch (e) {
    if (e.code === 404) {
      return null;
    }

    throw e;
  }
}

async function findIssue(context, title) {
  const issues = await context.github.issues.listForRepo(context.repo({
    state: "open",
    per_page: 100,
  }));

  issues.forEach((issue) => {
    if (issue.title == title) {
      return issue.id
    }
  })

  return null
}
