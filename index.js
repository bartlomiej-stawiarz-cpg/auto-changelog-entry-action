const core = require('@actions/core');
const github = require('@actions/github');
const { promises: fs } = require('fs');


function getPullRequestData() {
    return {
        title: github.context.payload.pull_request.title,
        body: github.context.payload.pull_request.body,
        labels: github.context.payload.pull_request.labels,
        author: github.context.payload.pull_request.user.login
    }
}

function processTemplateConfigTable(prDescription) {
    if (!prDescription.length) {
        return {};
    }

    let lines = prDescription.split(/\r?\n/);

    let emptyLineFound = false;
    let potentialHeadingFound = false;
    let headingFound = false;

    let results = {};

    for (i = 0; i < lines.length; i++) {
        let line = lines[i];

        if (headingFound) {
            let match = line.match(/^\|?(\ *\w+\ *)\|((?:(?:\\\|)?[^\|]*?)*)\|?$/);

            if (!match) {
                break;
            }

            results[match[1].toUpper()] = match[2];
        }
        else if (potentialHeadingFound) {
            if (line.match(/^\|?\ *:?\-{3,}:?\ *\|\ *:?\-{3,}:?\ *\|?$/)) {
                headingFound = true;
                continue;
            }

            emptyLineFound = false;
            potentialHeadingFound = false;
        }
        else if (emptyLineFound) {
            if (line.match(/^\|?\ *Key\ *\|\ *Value\ *\|?$/)) {
                potentialHeadingFound = true;
            }
        }
        else {
            if (line === '') {
                emptyLineFound = true;
            }
        }
    }

    return results;
}

function prepareChangelogEntryText(template, templateVariableDefinitions) {
    Object.keys(templateVariableDefinitions).forEach(key => {
        template = template.replaceAll(`$${key.toUpper()}`, templateVariableDefinitions[key]);
    });
}


async function run() {
    console.log('--- RUNNING AUTO CHANGELOG ---');

    try {
        pullRequest = getPullRequestData();
        template = core.getInput('template');
        ignoreLabel = core.getInput('ignore-label');
    
        if (ignoreLabel === "" || !pullRequest.labels.includes(ignoreLabel)) {
            let templateVariables = {
                date_time: new Date().toISOString(),
                author: pullRequest.author,
                title: pullRequest.title
            }
            let data = {...processTemplateConfigTable(pullRequest.body), ...templateVariables };
            let entryText = prepareChangelogEntryText(template, data);

            console.log(`Prepared entry text: ${entryText}`);
        }
    }
    catch (error) {
        core.setFailed(error.message);
    }
}

run();

