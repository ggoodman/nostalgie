//@ts-check
'use strict';

const { promises: Fs } = require('fs');
const Path = require('path');

const Chalk = require('chalk');
const Degit = require('degit');
const Yargs = require('yargs');
const GitRemoteOriginUrl = require('git-remote-origin-url');
const GitHubUrlFromGit = require('github-url-from-git');
const ChildProcess = require('child_process');
const Events = require('events');

const templates = {
  javascript: 'ggoodman/nostalgie/packages/template-javascript#main',
  typescript: 'ggoodman/nostalgie/packages/template-typescript#main',
};

const allowedFiles = new Set(['.gitignore']);
const allowedDirectories = new Set(['.git']);

/**
 *
 * @param {import('fs').Dirent} entry
 */
function ignoreEntry(entry) {
  if (entry.isDirectory() && allowedDirectories.has(entry.name)) return true;
  if (entry.isFile() && allowedFiles.has(entry.name)) return true;

  return false;
}

function init() {
  Yargs.usage(
    '$0 [dest]',
    'Scaffold a Nostalgie App into the target directory.',
    (yargs) =>
      yargs
        .positional('dest', {
          description: 'target directory',
          type: 'string',
        })
        .options({
          force: {
            boolean: true,
            description: 'Force scaffolding even if the target directory is not empty.',
          },
          template: {
            choices: Object.keys(templates),
            description: 'Choose a starting template based on your authoring language of choice.',
            default: 'javascript',
          },
        }),
    async (argv) => {
      try {
        const dest = Path.resolve(process.cwd(), argv.dest || '.');
        const destName = Path.basename(dest);
        const gitRemote = await getGitOrigin(dest);

        try {
          const entries = await Fs.readdir(dest, { withFileTypes: true });

          for (const entry of entries) {
            if (!argv.force && !ignoreEntry(entry)) {
              throw new Error(
                `The destination directory ${JSON.stringify(
                  `./${Path.relative(process.cwd(), dest)}`
                )} is not empty.`
              );
            }
          }

          if (entries.length && !argv.force) {
          }
        } catch (err) {
          // Don't throw if the directory doesn't exist
          if (err.code !== 'ENOENT') {
            await Fs.mkdir(dest, { recursive: true });

            throw err;
          }
        }

        const degit = Degit(templates[argv.template]);

        degit.on('info', (event) => {
          console.error(Chalk.cyan(`> ${event.message.replace('options.', '--')}`));
        });

        degit.on('warn', (event) => {
          console.error(Chalk.magenta(`! ${event.message.replace('options.', '--')}`));
        });

        await degit.clone(dest);

        const packageJsonHandle = await Fs.open(Path.resolve(dest, './package.json'), 'r+');
        try {
          const packageJsonData = await packageJsonHandle.readFile('utf8');
          const packageJson = JSON.parse(packageJsonData);

          packageJson.name = destName;

          if (gitRemote) {
            /** @type {string | undefined} */
            const githubUrl = GitHubUrlFromGit(gitRemote);

            packageJson.repository = {
              type: 'git',
              url: githubUrl ? `git+${githubUrl}.git` : gitRemote,
            };

            if (githubUrl) {
              packageJson.bugs = {
                url: `${githubUrl}/issues`,
              };
              packageJson.homepage = `${githubUrl}#readme`;
            }
          }

          const { bytesWritten } = await packageJsonHandle.write(
            JSON.stringify(packageJson, null, 2),
            0,
            'utf8'
          );
          await packageJsonHandle.truncate(bytesWritten);
        } finally {
          await packageJsonHandle.close();
        }

        // We have a .npmrc in the template to prevent a package-lock.json from being
        // baked into the template. Degit has likely happily reproduced that file so let's
        // blow it away.
        await Fs.unlink(Path.resolve(dest, './.npmrc'));

        console.error(Chalk.cyan(`> Installing dependencies`));

        // Now that the project is scaffolded, let's install dependencies
        const child = ChildProcess.spawn('npm', ['install', '--no-fund', '--no-audit'], {
          cwd: dest,
          env: {
            ...process.env,
            npm_config_loglevel: 'warn',
            npm_config_progress: 'false',
          },
          stdio: ['ignore', 2, 'inherit'],
        });

        await Events.once(child, 'exit');

        console.error(Chalk.greenBright('- Your Nostalgie project is now ready! To get started:'));
        console.error(Chalk.green(`  $ ${Chalk.bold(`cd ${destName}`)}`));
        console.error(Chalk.green(`  $ ${Chalk.bold(`npm run dev`)}`));
      } catch (err) {
        console.error(Chalk.red(`! ${err.message.replace('options.', '--')}`));
        process.exit(1);
      }
    }
  )

    .help()
    .showHelpOnFail(true).argv;
}

async function getGitOrigin(cwd) {
  try {
    return await GitRemoteOriginUrl(cwd);
  } catch (_err) {
    return undefined;
  }
}

exports.init = init;
