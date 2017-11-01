#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

if (process.argv.length <= 2) {
  console.error('You need to pass a list of the files you\'d like to upgrade, like so: `upgradeSyntaxFrom2To3 src/*`');
  process.exit(1);
}

const cyan = '\u{1b}[36m';
const cyanEnd = '\u{1b}[39m';
const dim = '\u{1b}[2m';
const dimEnd = '\u{1b}[22m';

const filesToMigrate = process.argv.slice(2);
console.log(`${cyan}Starting Reason syntax 2 -> 3 migration!${cyanEnd}
${dim}Note that this is just a dumb script that takes all your files and do:

  ./node_modules/bs-platform/bin/refmt.exe --print binary_reason foo.re | ./node_modules/bs-platform/bin/refmt2.exe --parse binary_reason --print re${dimEnd}
`)

let filesThatAreBackups = [];
let filesThatAreInvalid = [];
let filesThatHaveBackups = [];
const binariesRoot = path.join('.', 'node_modules', 'bs-platform', 'bin');
const bsconfig = path.join('.', 'bsconfig.json');

const packageLock = path.join('.', 'package-lock.json');
const shrinkwrap = path.join('.', 'npm-shrinkwrap.json');
const yarnlock = path.join('.', 'yarn.lock');

function migrate(files) {
  let addRefmt3ToBsconfig;

  // check that bsconfig exists
  if (fs.existsSync(bsconfig)) {
    const bsconfigContent = fs.readFileSync(bsconfig, {encoding: 'utf-8'});
    addRefmt3ToBsconfig = bsconfigContent.indexOf('refmt') === -1
      ? `${cyan}Please add \`"refmt": 3\` to your \`bsconfig.json\`${cyanEnd}`
      : `Add \`"refmt": 3\` to your \`bsconfig.json\`, then run the build again to verify that nothing errored.`;
  } else {
    console.log(`${cyan}
We can't found a bsconfig.json file in this project${cyanEnd}; did you invoke the upgrade command at the right place?`);
    return;
  }

  const oldBinary = path.join(binariesRoot, 'refmt.exe');
  const newBinary = path.join(binariesRoot, 'refmt3.exe');

  files.forEach((file) => {
    const extension = path.extname(file);

    if (extension === '.backup') {
      filesThatAreBackups.push(file);
      return;
    }

    if (extension !== '.re' && extension !== '.rei') {
      // not reason file
      return;
    }

    if (fs.existsSync(file + '.backup')) {
      filesThatHaveBackups.push(file);
      return;
    }

    const finalPrintingFlags = extension === '.re'
      ? ['--parse', 'binary_reason', '--print', 're']
      : ['--parse', 'binary_reason', '--print', 're', '--interface', 'true'];

    const backupName = file + '.backup';

    const parsingFlags = extension === '.re'
      ? ['--parse', 're', '--print', 'binary_reason']
      : ['--parse', 're', '--print', 'binary_reason', '--interface', 'true'];

    const isInterfaceFlag = extension === '.re'
      ? ''
      : '--interface true';

    const fileContent = fs.readFileSync(file, {encoding: 'utf-8'});
    // backup the file
    fs.writeFileSync(backupName, fileContent, {encoding: 'utf-8'});
    let binaryAST;
    try {
      binaryAST = childProcess.execSync(`${oldBinary} --parse re --print binary_reason ${isInterfaceFlag} ${backupName}`);
    } catch(e) {
      filesThatAreInvalid.push(file);
      console.log(e.message);
      return;
    }

    const tempName = backupName + '.temp';
    fs.writeFileSync(tempName, binaryAST, {encoding: 'utf-8'});

    const finalContent = childProcess.execSync(`${newBinary} --parse binary_reason --print re ${isInterfaceFlag} ${tempName}`);
    fs.writeFileSync(file, finalContent, {encoding: 'utf-8'});

    fs.unlinkSync(tempName);
  })

  if (filesThatAreBackups.length !== 0) {
      console.log(`${cyan}
The follow files are skipped, because they're backup files from a previous run of this script:
${cyanEnd}`);
      console.log(filesThatAreBackups.map(f => '- ' + f).join('\n'));
  }

  if (filesThatAreInvalid.length !== 0) {
      console.log(`${cyan}
The follow files failed to transform (syntax error or missing refmt):
${cyanEnd}`);
      console.log(filesThatAreInvalid.map(f => '- ' + f).join('\n'));
  }

  if (filesThatHaveBackups.length !== 0) {
      console.log(`${cyan}
The follow files are skipped, because they already have their backup (and are this presumed to be transformed already):
${cyanEnd}`);
      console.log(filesThatHaveBackups.map(f => '- ' + f).join('\n'));
  }

  const packageLockContent = fs.existsSync(packageLock) ? fs.readFileSync(packageLock, {encoding: 'utf-8'}) : '';
  const shrinkwrapContent = fs.existsSync(shrinkwrap) ? fs.readFileSync(shrinkwrap, {encoding: 'utf-8'}) : '';
  const yarnlockContent = fs.existsSync(yarnlock) ? fs.readFileSync(yarnlock, {encoding: 'utf-8'}) : '';

  const hasLockedBsPlatform =
    packageLockContent.indexOf('bs-platform') >= 0
    || shrinkwrapContent.indexOf('bs-platform') >= 0
    || yarnlockContent.indexOf('bs-platform') >= 0;

  const unlockBsPlatform = hasLockedBsPlatform
    ? `\n- ${cyan}You seem to have locked bs-platform in your npm/yarn lockfile${cyanEnd}. Make sure you've actually upgraded bs-platform!`
    : '';

  console.log(`${cyan}
All done! IMPORTANT things to do after the codemod:${cyanEnd}

- We've backed up your old code at \`yourFileName.backup\`. Feel free to examine & delete them.
- ${addRefmt3ToBsconfig}${unlockBsPlatform}

If there's any change to your build or artifacts, please check and file us an issue. Apologies in advance; it's a big refactoring.

Thank you!`);
}

migrate(filesToMigrate);
