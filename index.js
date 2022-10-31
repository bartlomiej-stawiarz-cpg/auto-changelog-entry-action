const core = require('@actions/core');
const github = require('@actions/github');


try {
    console.log(JSON.stringify(github.context.payload, undefined, 2));
}
catch (error) {
    core.setFailed(error.message);
}