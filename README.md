# Convert your Reason project from Reason 2 to 3

## What is Reason 2/3?

See the announcement here: https://reasonml.github.io/community/blog/#reason-3
And the changelog guide here: https://github.com/facebook/reason/blob/master/HISTORY.md#300

## How do I upgrade my project?

Do this at the root of your project:

```
npm install -g upgrade-reason-syntax
npm install --save-dev bs-platform@2.0.0
upgradeSyntaxFrom2To3 mySource/*
```

The script accepts a list of files/globs to convert. Pass as many as you want. It'll intelligently skip over any file that's not Reason.

After you're done converting your projects:

- Remove the backup files at `mySource/*.backup`
- Add `"refmt": 3` to your bsconfig.json to make BuckleScript use the new syntax.
- Feel free to uninstall this library!

## How does it work?

It's a simple node.js script that takes the old `refmt` and the new `refmt3` from your project's BuckleScript 2.0.0's source at `node_modules/bs-platform`, and then:

- Iterates over all your relevant files, making a backup copy
- Turns your Reason files into an AST (abstract syntax tree) using `refmt`
- Turns the ASTs into the new syntax using `refmt3` and writes them back

That's it! Enjoy =)
