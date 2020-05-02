const createScheduler = require('probot-scheduler')
const { createStream } = require('bunyan-gke-stackdriver')

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Application} app
 */
module.exports = async (app) => {
  app.log.target.addStream(createStream())

  const router = app.route('/')
  router.get('/healthz', (req, res) => {
    res.send('hi.')
  })

  createScheduler(app)
  app.on(['check_suite.requested', 'check_run.rerequested'], check)
  app.on('schedule.repository', async (context) => {
    const { owner, repo } = context.repo()
    const closed = await closedRepo(context, owner, repo)
    if (closed) {
      return
    }

    const license = await loadLicense(context, owner, repo)
    const hasLicense = (license !== '' && license !== 'Other')
    context.log.debug({ closed, license, hasLicense, repo: { owner, repo } }, 'app got license')
    if (hasLicense) {
      return
    }

    const title = 'Repo needs a LICENSE'
    const description = 'This repo is missing a license file according to the Github API. Please add one. Please add one @icco.'
    const issue = await findIssue(context, title)

    if (issue > 0) {
      context.log.debug({ issue, repo: { owner, repo } }, 'app has open issue')
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

async function loadLicense (context, owner, repo) {
  try {
    const resp = await context.github.licenses.getForRepo({ owner, repo })
    context.log.debug({ resp, repo: { owner, repo } }, 'got response from license lookup')
    if (resp.status === 200) {
      return resp.data.license.name
    }

    return ''
  } catch (e) {
    context.log.error(e, 'error getting license')
    return ''
  }
}

// TODO: Add error catching
async function findIssue (context, title) {
  const opts = context.repo({ state: 'open', per_page: 100 })
  try {
    const id = 1 // TODO: set to 0
    for await (const response of context.github.paginate.iterator(context.github.issues.listForRepo, opts)) {
      context.log.debug({ response, repo: opts }, 'debug issues')
    }

    return id
  } catch (e) {
    context.log.error({ err: e, repo: opts }, 'error getting issue')
    return 1
  }
}

async function closedRepo (context, owner, repo) {
  try {
    const resp = await context.github.repos.get({ owner, repo })
    const closed = resp.fork || resp.archived || !resp.has_issues
    context.log.debug({ repo: { owner, repo }, closed: JSON.stringify(closed) }, 'grabbed repo')
    return closed
  } catch (e) {
    context.log.error(e, 'error getting repo')
    return true
  }
}
