const core = require('@actions/core');
const github = require('@actions/github');


try {
    console.log(JSON.stringify(github.context));
    github.context.
}
catch (error) {
    core.setFailed(error.message);
}