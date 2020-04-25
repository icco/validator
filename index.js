const createScheduler = require('probot-scheduler')
const lb = require('@google-cloud/logging-bunyan')

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Application} app
 */
module.exports = async (app) => {
  const { mw } = await lb.express.middleware()
  const router = app.route('/')
  router.get('/healthz', (req, res) => {
    res.send('hi.')
  })
  router.use(mw)

  createScheduler(app)
  app.on(['check_suite.requested', 'check_run.rerequested'], check)
  app.on('schedule.repository', context => {
    const license = loadLicense(context)
    if (license != null) {
      context.log("app has license")
      return
    }

    const title = 'Repo needs a LICENSE'
    const description = 'This repo is missing a license file according to the Github API. Please add one.'
    const issue = findIssue(context, title)

    if (issue != null) {
      context.log("app has open issue")
      return
    }

    context.github.issues.create(context.repo({
      title,
      description
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
    return resp.data.content
  } catch (e) {
    if (e.status === 404) {
      return null
    }

    context.log.error(e, 'getting license')
  }
}

async function findIssue (context, title) {
  let id = null
  const options = context.github.issues.getAll.endpoint.merge(context.repo({
    state: 'open',
    per_page: 100
  }))
  context.github.paginate(options, (res, done) => {
    for (const issue of res.data) {
      if (issue.title === title) {
        id = issue.id
        done()
        break
      }
    }
  })

  return id
}
