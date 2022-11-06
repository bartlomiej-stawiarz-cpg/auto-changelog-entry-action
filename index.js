const core = require('@actions/core');
const github = require('@actions/github');
const { promises: fs } = require('fs');


function getPullRequestData() {
    return {
        title: github.context.payload.pull_request.title,
        body: github.context.payload.pull_request.body,
        labels: github.context.payload.pull_request.labels.map(label => label.name),
        author: github.context.payload.pull_request.user.login,
        number: github.context.payload.pull_request.number,
        url: github.context.payload.pull_request.html_url
    }
}

function processTemplateConfigTable(prDescription) {
    if (!prDescription.length) {
        return {};
    }

    let lines = prDescription.split(/\r?\n/);

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

            results[match[1].trim()] = match[2].trim();
        }
        else if (potentialHeadingFound) {
            if (line.match(/^\|?\ *:?\-{3,}:?\ *\|\ *:?\-{3,}:?\ *\|?$/)) {
                headingFound = true;
                continue;
            }

            potentialHeadingFound = false;
        }
        else {
            if (line.match(/^\|?\ *Key\ *\|\ *Value\ *\|?$/)) {
                potentialHeadingFound = true;
            }
        }
    }

    return results;
}

function prepareChangelogEntryText(template, templateVariableDefinitions) {
    Object.keys(templateVariableDefinitions).forEach(key => {
        template = template.replaceAll(`$CL_${key.toUpperCase().trim()}`, templateVariableDefinitions[key]);
    });

    return template;
}


async function run() {
    console.log('--- RUNNING AUTO CHANGELOG ---');

    try {
        pullRequest = getPullRequestData();
        template = core.getInput('template');
        ignoreLabel = core.getInput('ignore-label');
        changelogFileName = core.getInput('changelog-file');
        typeLabelPrefix = core.getInput('type-label-prefix');
        targetDir = core.getInput('target-dir');

        if (ignoreLabel === "" || !pullRequest.labels.includes(ignoreLabel)) {
            let templateVariables = {
                author: pullRequest.author,
                title: pullRequest.title,
                type: pullRequest.labels.find(el => el.startsWith(typeLabelPrefix))?.substring(typeLabelPrefix.length) ?? 'other',
                number: pullRequest.number,
                url: pullRequest.url
            }
            let data = {...processTemplateConfigTable(pullRequest.body), ...templateVariables };
            let entryText = prepareChangelogEntryText(template, data);

            console.log(`Resolved variables: ${JSON.stringify(data)}`);
            console.log(`Prepared entry text: ${entryText}`);

            let changelogfile;

            try {
                console.log(`Target dir: ${targetDir}`);
                changelogFile = await fs.open(core.toPlatformPath(`${targetDir}/${changelogFileName}`), 'w+');
                let changelogContent = await changelogFile.readFile({encoding: 'utf8'});
                
                console.log(changelogContent);

                let files = await fs.readdir(targetDir);
                console.log(JSON.stringify(files));

                await changelogFile.write(`${entryText}\n`, 0);
                await changelogFile.write(changelogContent, entryText.length + 1);
            }
            finally {
                changelogfile?.close();
            }
        }
        else {
            console.log('Skipped adding changelog entry because ignore label was found');
        }
    }
    catch (error) {
        core.setFailed(error.message);
    }
}

run();

