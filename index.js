const core = require('@actions/core');
const github = require('@actions/github');

console.log('--- RUNNING AUTO CHANGELOG ---');

try {
    console.log('Tried');
}
catch (error) {
    core.setFailed(error.message);
    console.log('Failed');
}