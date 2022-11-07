const core = require('@actions/core');
const github = require('@actions/github');
const { promises: fs } = require('fs');
const yaml = require('yaml');


function getPullRequestData() {
    return {
        title: github.context.payload.pull_request.title,
        body: github.context.payload.pull_request.body,
        labels: github.context.payload.pull_request.labels.map(label => label.name),
        author: github.context.payload.pull_request.user.login,
        author_url: github.context.payload.pull_request.user.html_url,
        merged_by: github.context.payload.pull_request.merged_by.login,
        merged_by_url: github.context.payload.pull_request.merged_by.html_url,
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

function combineLabels(labels, labelGroup, prefix, suffix) {
    const separator = labelGroup.separator ?? ',';

    const combinedLabels = labels.join(separator);

    return `${prefix}${combinedLabels}${suffix}`;
}

function separateLabels(labels, labelGroup, prefix, suffix) {
    const separator = labelGroup.separator ?? ' ';

    let results = [];

    labels.forEach(label => results.push(`${prefix}${label}${suffix}`));

    return results.join(separator);
}

function processLabelGroup(labelGroup, labels) {
    const typeProcessors = {'combined': combineLabels, 'separate': separateLabels};

    const prefix = labelGroup.prefix ?? '';
    const suffix = labelGroup.suffix ?? '';

    let presentLabels;

    if (Array.isArray(labelGroup.labels)) {
        presentLabels = labelGroup.labels.filter(label => labels.includes(label));
    }
    else {
        presentLabels = labels.filter(label => label.startsWith(labelGroup.labels));
    }

    if (!presentLabels.length) {
        return labelGroup.default !== undefined ? `${prefix}${labelGroup.default}${suffix}` : '';
    }
    
    if (labelGroup.replacers) {
        labelGroup.replacers.forEach(replacer => {
            presentLabels = presentLabels.map(label => label.replaceAll(replacer.from, replacer.to));
        });
    }

    return typeProcessors[labelGroup.type](presentLabels, labelGroup, prefix, suffix);
}

function processLabels(labelGroups, labels) {
    const results = {};

    labelGroups.forEach(labelGroup => {
        results[`label_${labelGroup.id.toLowerCase()}`] = processLabelGroup(labelGroup, labels);
    });

    return results;
}

function prepareChangelogEntryText(template, templateVariableDefinitions) {
    Object.keys(templateVariableDefinitions).forEach(key => {
        template = template.replaceAll(`$CL_${key.toUpperCase().trim()}`, templateVariableDefinitions[key]);
    });

    return template;
}

function getDefaultConfig() {
    return {
        'changelog-file-path': 'CHANGELOG.md',
        'template': '$CL_TITLE',
        'label-groups': []
    }
}

async function buildConfig(configFilePath) {
    let config = getDefaultConfig();

    try {
        const configFileContent = await fs.readFile(configFilePath, {encoding: 'utf8'});
        const parsed_config = yaml.parse(configFileContent);
        config = { ...config, ...parsed_config };
        
    }
    catch (err) {
        console.log('Could not load configuration. File is invalid or does not exist.');
    }
    
    return config;
}


async function run() {
    console.log('--- RUNNING AUTO CHANGELOG ---');

    try {
        const pullRequest = getPullRequestData();
        const ignoreLabel = core.getInput('ignore-label');
        const configFilePath = core.getInput('config-file');

        if (ignoreLabel !== '' && pullRequest.labels.includes(ignoreLabel)) {
            console.log('Skipped adding changelog entry because ignore label was found');
            return;  
        }

        const config = await buildConfig(configFilePath);
        const changelogFilePath = core.toPlatformPath(config['changelog-file-path']);
        const template = config['template'];
        const labelGroups = config['label-groups'];

        let templateVariables = {
            author: pullRequest.author,
            author_url: pullRequest.author_url,
            title: pullRequest.title,
            number: pullRequest.number,
            url: pullRequest.url,
            merged_by: pullRequest.merged_by,
            merged_by_url: pullRequest.merged_by_url
        }
        let data = {...processTemplateConfigTable(pullRequest.body), ...processLabels(labelGroups, pullRequest.labels), ...templateVariables };
        let entryText = prepareChangelogEntryText(template, data);


        console.log(`Configuration: ${JSON.stringify(config)}`);
        console.log(`Resolved variables: ${JSON.stringify(data)}`);
        console.log(`Prepared entry text: ${entryText}`);

        let changelogfile;

        try {
            changelogFile = await fs.open(core.toPlatformPath(changelogFilePath), 'r+');
            let changelogContent = await changelogFile.readFile({encoding: 'utf8'});
            
            entryText = `${entryText}\n`;
            await changelogFile.write(entryText, 0);
            await changelogFile.write(changelogContent, entryText.length);
        }
        finally {
            changelogfile?.close();
        }
    }
    catch (error) {
        core.setFailed(error.message);
    }
}

run();

