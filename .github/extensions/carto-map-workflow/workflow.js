const status = document.querySelector('#status');
const stageList = document.querySelector('#stages');
const supportingFlows = document.querySelector('#supporting-flows');
const filters = [...document.querySelectorAll('[data-filter]')];
let stageElements = [];

function makeTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function appendFileList(parent, files) {
  const list = document.createElement('ul');
  for (const file of files) list.append(makeTextElement('li', '', file));
  parent.append(list);
}

function renderStage(stage, index) {
  const item = document.createElement('li');
  item.className = 'stage';
  item.dataset.category = stage.category;
  item.append(makeTextElement('span', 'stage-number', String(index + 1)));
  item.append(makeTextElement('p', 'stage-kicker', stage.category));
  item.append(makeTextElement('h3', '', stage.title));
  item.append(makeTextElement('p', 'stage-summary', stage.summary));

  const details = document.createElement('details');
  details.append(makeTextElement('summary', '', 'Implementation details'));
  const content = document.createElement('div');
  content.className = 'stage-details';
  content.append(makeTextElement('p', 'stage-implementation', stage.implementation));

  const filesSection = document.createElement('section');
  filesSection.append(makeTextElement('h4', '', 'Code'));
  appendFileList(filesSection, stage.files);
  content.append(filesSection);

  const outputSection = document.createElement('section');
  outputSection.append(makeTextElement('h4', '', 'Output'));
  outputSection.append(makeTextElement('p', '', stage.output));
  content.append(outputSection);
  details.append(content);
  item.append(details);
  return item;
}

function renderSupportingFlow(flow) {
  const card = document.createElement('article');
  card.className = 'support-card';
  card.append(makeTextElement('h3', '', flow.title));
  card.append(makeTextElement('p', '', flow.description));
  appendFileList(card, flow.files);
  return card;
}

function applyFilter(filter) {
  for (const button of filters) {
    button.setAttribute('aria-pressed', String(button.dataset.filter === filter));
  }
  let visible = 0;
  for (const stage of stageElements) {
    const show = filter === 'all' || stage.dataset.category === filter;
    stage.hidden = !show;
    if (show) visible += 1;
  }
  status.textContent = `${visible} ${visible === 1 ? 'stage' : 'stages'} shown.`;
}

async function loadWorkflow() {
  try {
    const response = await fetch('/api/workflow');
    if (!response.ok) throw new Error(`Workflow request failed (${response.status}).`);
    const data = await response.json();
    if (!data || !Array.isArray(data.stages) || !Array.isArray(data.supportingFlows)) {
      throw new Error('Workflow response has an unexpected format.');
    }

    document.querySelector('#workflow-description').textContent = data.description;
    document.querySelector('#stage-count').textContent = `${data.stages.length} stages`;
    stageElements = data.stages.map(renderStage);
    stageList.replaceChildren(...stageElements);
    supportingFlows.replaceChildren(...data.supportingFlows.map(renderSupportingFlow));
    applyFilter('all');
  } catch (error) {
    status.textContent = `Unable to load the workflow: ${error instanceof Error ? error.message : String(error)}`;
  }
}

for (const button of filters) {
  button.addEventListener('click', () => applyFilter(button.dataset.filter));
}

loadWorkflow();
