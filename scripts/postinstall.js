// Mostly copied from https://github.com/nodegit/nodegit/blob/288ab93/lifecycleScripts/postinstall.js
const path = require('path')
const fs = require('fs')
const os = require('os')

const log = require('npmlog')
const envPaths = require('env-paths')

const rimraf = require('./utils/rimraf')

const homeDir = os.homedir()

let { version } = process
let gypFolder = envPaths('node-gyp', { suffix: '' }).cache

if (process.env.npm_config_runtime === 'node-webkit') {
  version = process.env.npm_config_target
  gypFolder = path.resolve(homeDir, '.nw-gyp')
}

// node-gyp path from here: https://github.com/nodejs/node-gyp/blob/v5.0.3/bin/node-gyp.js#L31
const gypDir = path.resolve(gypFolder, version.replace('v', ''))

// reverting what we do on tools/retrieve-win-deps.js
const opensslFolder = path.resolve(gypDir, 'include', 'node', 'openssl')
const opensslFolderDisabled = `${opensslFolder}.disabled`
if (fs.existsSync(opensslFolderDisabled)) {
  fs.renameSync(opensslFolderDisabled, opensslFolder)
}

const buildFlags = require('./buildFlags')
const exec = require('./execPromise')

log.heading = 'trusted-curl'

const rootPath = path.join(__dirname, '..')

function printStandardLibError() {
  log.error('the latest libstdc++ is missing on your system!')
  log.error('On Ubuntu you can install it using:')
  log.error('$ sudo add-apt-repository ppa:ubuntu-toolchain-r/test')
  log.error('$ sudo apt-get update')
  log.error('$ sudo apt-get install libstdc++-4.9-dev')
}

module.exports = function install() {
  if (buildFlags.isGitRepo) {
    // If we're building NodeGit from a git repo we aren't going to do any
    // cleaning up
    return Promise.resolve()
  }

  if (buildFlags.isElectron || buildFlags.isNWjs) {
    // If we're building for electron or NWjs, we're unable to require the
    // built library so we have to just assume success, unfortunately.
    return Promise.resolve()
  }

  const distIndexPath = path.resolve(rootPath, 'dist', 'index.js')
  const distIndexExists = fs.existsSync(distIndexPath)
  const executable = distIndexExists ? 'node' : 'yarn ts-node'
  const file = distIndexExists
    ? distIndexPath
    : path.resolve(rootPath, 'lib', 'index.ts')

  return exec(`${executable} "${file}"`)
    .catch(function(e) {
      if (~e.toString().indexOf('Module version mismatch')) {
        log.warn('trusted-curl was built for a different version of node.')
        log.warn(
          'If you are building trusted-curl for electron/nwjs you can ignore this warning.',
        )
      } else {
        throw e
      }
    })
    .then(function() {
      // If we're using trusted-curl from a package manager then let's clean up after
      // ourselves when we install successfully.
      if (!buildFlags.mustBuild) {
        // We can't remove the source files yet because apparently the
        // "standard workflow" for native node modules in Electron/nwjs is to
        // build them for node and then nah eff that noise let's rebuild them
        // again for the actual platform! Hurray!!! When that madness is dead
        // we can clean up the source which is a serious amount of data.
        rimraf.sync(path.join(rootPath, 'build'))
        if (fs.existsSync(path.join(rootPath, 'curl-for-windows'))) {
          rimraf.sync(path.join(rootPath, 'curl-for-windows'))
        }
      }
    })
}

// Called on the command line
if (require.main === module) {
  module.exports().catch(function(e) {
    log.warn('Could not finish postinstall')

    if (process.platform === 'linux' && ~e.toString().indexOf('libstdc++')) {
      printStandardLibError()
    } else {
      log.error(e)
    }
  })
}
