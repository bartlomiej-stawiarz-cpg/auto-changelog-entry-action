const core = require('@actions/core');
const github = require('@actions/github');

console.log('--- RUNNING AUTO CHANGELOG ---')

try {
    console.log(JSON.stringify(github.event.pull_request));
}
catch (error) {
    core.setFailed(error.message);
}