'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

if (process.argv.length <= 2) {
  console.error('You need to pass a list of the files you\'d like to upgrade, like so: `upgradeSyntaxFrom2To3 src/*`');
  process.exit(1);
}
const filesToMigrate = process.argv.slice(2);
console.log(`\u{1b}[36m
***
Starting Reason syntax version 2 -> version 3 migration!

Note that this is just a dumb script that takes all your files and do:

  ./node_modules/bs-platform/bin/refmt.exe --print binary_reason foo.re | ./node_modules/bs-platform/bin/refmt2.exe --parse binary_reason --print re

Things to do after the codemod:

- Run the build system again and see nothing errored.
- If you've checked in the JS artifacts, make sure they didn't change. Your artifacts are your snapshot tests =)

***
\u{1b}[39m`)

let filesThatAreBackups = [];
let filesThatAreNotReason = [];
let filesThatAreInvalid = [];
let filesThatHaveBackups = [];
const binariesRoot = path.join('.', 'node_modules', 'bs-platform', 'bin');

function migrate(files) {
  const oldBinary = path.join(binariesRoot, 'refmt.exe');
  const newBinary = path.join(binariesRoot, 'refmt3.exe');

  files.forEach((file) => {
    const extension = path.extname(file);

    if (extension === '.backup') {
      filesThatAreBackups.push(file);
      return;
    }

    if (extension !== '.re' && extension !== '.rei') {
      filesThatAreNotReason.push(file);
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
      console.log(`\u{1b}[36m
The follow files are skipped, because they're backup files from a previous run of this script:
\u{1b}[39m`);
      console.log(filesThatAreBackups.map(f => '- ' + f).join('\n'));
  }
  if (filesThatAreNotReason.length !== 0) {
      console.log(`\u{1b}[36m
The follow files are skipped, because they're not Reason files:
\u{1b}[39m`);
      console.log(filesThatAreNotReason.map(f => '- ' + f).join('\n'));
  }

  if (filesThatAreInvalid.length !== 0) {
      console.log(`\u{1b}[36m
The follow files are skipped, because they contain syntax errors:
\u{1b}[39m`);
      console.log(filesThatAreInvalid.map(f => '- ' + f).join('\n'));
  }

  if (filesThatHaveBackups.length !== 0) {
      console.log(`\u{1b}[36m
The follow files are skipped, because they already have their backup (and are this presumed to be transformed already):
\u{1b}[39m`);
      console.log(filesThatHaveBackups.map(f => '- ' + f).join('\n'));
  }

  console.log(`\u{1b}[36m
All done. We've kept a copy of your old code at \`yourFileName.backup.re\`.
Feel free to examine them, then delete them.

If there's any change to your build or artifacts, please check and file us an issue. Apologies in advance; it's been a really big refactoring.

Thank you!
\u{1b}[39m`);
}

migrate(filesToMigrate);
