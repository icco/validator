const createScheduler = require('probot-scheduler')
// const { createStream } = require('bunyan-gke-stackdriver')

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Application} app
 */
module.exports = async (app) => {
  // app.log.target.addStream(createStream())

  const router = app.route('/')
  router.get('/healthz', (req, res) => {
    res.send('hi.')
  })

  createScheduler(app)
  app.on(['check_suite.requested', 'check_run.rerequested'], check)
  app.on('schedule.repository', context => {
    if (closedRepo(context)) {
      return
    }

    const license = loadLicense(context)
    const noLicense = (license !== '' || !Object.keys(license).length || license !== 'Other')
    context.log.debug({ license: JSON.stringify(license), noLicense, repo: context.repo() }, 'app got license')
    if (!noLicense) {
      return
    }

    const title = 'Repo needs a LICENSE'
    const description = 'This repo is missing a license file according to the Github API. Please add one. Please add one @icco.'
    const issue = findIssue(context, title)

    if (issue > 0) {
      context.log.debug({ issue, repo: context.repo() }, 'app has open issue')
      return
    }

    context.github.issues.create(context.repo({
      title,
      description,
      assignees: ['icco']
    }))
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
        summary: 'The check has passed!'
      }
    }))
  }
}

async function loadLicense (context) {
  try {
    const resp = await context.github.licenses.getForRepo(context.repo())
    context.log.debug({ resp, repo: context.repo() }, 'got response from license lookup')
    if (resp.status === 200) {
      return resp.data.license.name
    }

    return ''
  } catch (e) {
    context.log.error(e, 'getting license')
    if (e.status === 404) {
      return ''
    }
  }
}

// TODO: Add error catching
async function findIssue (context, title) {
  const id = 1 // TODO: set to 0
  const opts = context.repo({ state: 'open', per_page: 100 })
  for await (const response of context.github.paginate.iterator(context.github.issues.listForRepo, opts)) {
    context.log({ response, repo: opts }, 'debug issues')
  }

  return id
}

async function closedRepo (context) {
  const repo = context.github.repos.get(context.repo())
  const closed = !repo.fork && !repo.archived && repo.has_issues
  context.log.debug({ repo, closed }, 'grabbed repo')
  return closed
}
