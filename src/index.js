
require('file-loader?name=[name].[ext]!../privacy-policy.md');
require('file-loader?name=[name].[ext]!../index.html');
require('file-loader?name=[name].[ext]!../readme-picture.png');

import * as monaco from 'monaco-editor';

import tippy from 'tippy.js';

import 'bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'tippy.js/dist/tippy.css'
import './main.css'

import Split from 'split.js';

import { getXmlCompletionProvider, getXmlHoverProvider } from './completion-provider';
import { EditSvgCodeDb } from './firebase';

Split(['#editor', '#output'], {
  gutterSize: 5
});

const editor = monaco.editor.create(document.getElementById('editor'), {
  theme: 'vs-dark', // dark theme
  language: 'xml',
  automaticLayout: true,
  tabSize: 2,
  value: "Loading please wait...",
  readOnly: true
  // suggestOnTriggerCharacters: true,
})

function formatXml(xml) {
  // https://stackoverflow.com/questions/57039218/doesnt-monaco-editor-support-xml-language-by-default
  const PADDING = ' '.repeat(2);
  const reg = /(>)(<)(\/*)/g;
  let pad = 0;

  xml = xml.replace(reg, '$1\r\n$2$3');

  return xml.split('\r\n').map((node, index) => {
    let indent = 0;
    if (node.match(/.+<\/\w[^>]*>$/)) {
      indent = 0;
    } else if (node.match(/^<\/\w/) && pad > 0) {
      pad -= 1;
    } else if (node.match(/^<\w[^>]*[^/]>.*$/)) {
      indent = 1;
    } else {
      indent = 0;
    }

    pad += indent;

    return PADDING.repeat(pad - indent) + node;
  }).join('\r\n');
}

monaco.languages.registerDocumentFormattingEditProvider('xml', {
  async provideDocumentFormattingEdits(model, options, token) {
    return [
      {
        range: model.getFullModelRange(),
        text: formatXml(model.getValue()),
      },
    ];
  },
});

// register a completion item provider for xml language
monaco.languages.registerCompletionItemProvider('xml', getXmlCompletionProvider(monaco));
monaco.languages.registerHoverProvider('xml', getXmlHoverProvider(monaco));

import { parseVariables, substituteVariables } from './variables';

let activeVariables = [];

function renderSvg() {
  const xml = editor.getValue();
  const processedXml = substituteVariables(xml, activeVariables);
  document.getElementById('svg-container').innerHTML = processedXml;
}

function triggerAttackDecay(v) {
  const start = Date.now();
  const attack = v.attack * 1000;
  const decay = v.decay * 1000;
  const min = v.min;
  const max = v.max;

  function animate() {
    const now = Date.now();
    const elapsed = now - start;

    if (elapsed < attack) {
      // Attack phase: min -> max
      const t = elapsed / attack;
      v.currentValue = min + (max - min) * t;
    } else if (elapsed < attack + decay) {
      // Decay phase: max -> min
      const t = (elapsed - attack) / decay;
      v.currentValue = max - (max - min) * t;
    } else {
      v.currentValue = min;
      renderSvg();
      return;
    }
    renderSvg();
    requestAnimationFrame(animate);
  }
  animate();
}

function updateControls() {
  const container = document.getElementById('controls-container');
  container.innerHTML = '';

  if (activeVariables.length === 0) {
    container.innerHTML = '<div class="alert alert-secondary m-3">No variables defined. Add &lt;editsvg:variable name="..." ... /&gt; to the SVG.</div>';
    return;
  }

  const row = document.createElement('div');
  row.className = 'row g-3'; // Bootstrap row with gap
  container.appendChild(row);

  activeVariables.forEach(v => {
    const col = document.createElement('div');
    col.className = 'col-md-6 col-lg-4'; // Responsive columns
    row.appendChild(col);

    const card = document.createElement('div');
    card.className = 'card bg-dark text-light border-secondary h-100';
    col.appendChild(card);

    const cardBody = document.createElement('div');
    cardBody.className = 'card-body d-flex flex-column justify-content-center';
    card.appendChild(cardBody);

    const labelRow = document.createElement('div');
    labelRow.className = 'd-flex justify-content-between align-items-center mb-2';
    cardBody.appendChild(labelRow);

    const label = document.createElement('label');
    label.className = 'form-label fw-bold mb-0';
    label.innerText = v.label || v.name;
    labelRow.appendChild(label);

    if (v.type === 'slider') {
      const valDisplay = document.createElement('span');
      valDisplay.className = 'badge bg-primary';
      valDisplay.innerText = v.currentValue.toFixed(2);
      labelRow.appendChild(valDisplay);

      const input = document.createElement('input');
      input.type = 'range';
      input.className = 'form-range';
      input.min = v.min;
      input.max = v.max;
      input.step = v.step;
      input.value = v.currentValue;

      input.addEventListener('input', (e) => {
        v.currentValue = parseFloat(e.target.value);
        valDisplay.innerText = v.currentValue.toFixed(2);
        renderSvg();
      });

      cardBody.appendChild(input);
    } else if (v.type === 'button') {
      const btn = document.createElement('button');
      btn.innerText = "Trigger";
      btn.className = 'btn btn-outline-primary w-100';
      btn.addEventListener('click', () => {
        triggerAttackDecay(v);
      });
      cardBody.appendChild(btn);
    }
  });
}

function render() {
  const xml = editor.getValue();
  const newVariables = parseVariables(xml);

  // Merge with activeVariables to preserve state
  newVariables.forEach(v => {
    const existing = activeVariables.find(av => av.name === v.name);
    if (existing) {
      v.currentValue = existing.currentValue;
    } else {
      v.currentValue = v.value;
    }
  });
  activeVariables = newVariables;

  updateControls();
  renderSvg();
}

editor.onDidChangeModelContent((event) => {
  render();
});

var db = new EditSvgCodeDb();

function getUniqueId() {
  return document.location.pathname.split('/')[1];
}

function getNewUniqueId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

const btnSave = document.getElementById("save");
btnSave.addEventListener('click', function () {
  let uniqueId = getUniqueId() || getNewUniqueId();
  let text = editor.getValue();

  btnSave.disabled = true;

  // TODO: Collect actual metadata from UI or other sources
  let metadata = {
    savedBy: 'editsvgcode',
    version: '1.0',
    variables: activeVariables
  };

  db.saveDocument(uniqueId, text, metadata)
    .then(function () {
      history.pushState({}, "Saved", "/" + uniqueId);
    })
    .finally(function () {
      btnSave.disabled = false;
    })

});

document.getElementById("file_upload").addEventListener('change', function () {
  var reader = new FileReader();
  reader.onload = function (e) {
    var data = e.target.result;
    data = data.replace("data:image/svg+xml;base64,", "");
    editor.setValue(window.atob(data));
  };
  reader.readAsDataURL(this.files[0]);
});

document.getElementById("download").addEventListener('click', function () {
  const text = editor.getValue();
  var uniqueId = getUniqueId() || getNewUniqueId();
  var element = document.createElement('a');
  element.setAttribute('href', 'data:image/svg+xml;base64,' + window.btoa(text));
  element.setAttribute('download', uniqueId + ".svg");
  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
});

document.getElementById("upload").addEventListener('click', function () {
  document.getElementById("file_upload").click();
});

document.addEventListener('dbinit', function () {
  const uniqueId = getUniqueId();
  if (uniqueId) {
    db.loadDocument(uniqueId)
      .then(function (text) {
        editor.setValue(text);
        editor.updateOptions({ readOnly: false })
      })
  } else {
    editor.setValue(`<!-- sample rectangle -->
<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg" xmlns:editsvg="http://editsvgcode.com">
  <editsvg:variable name="w" value="150" min="20" max="300" label="Width" />
  <editsvg:variable name="h" value="150" min="20" max="300" label="Height" />
  <editsvg:variable name="strk" value="5" min="5" max="30" type="button" attack="0.1" decay="0.8" label="Stroke Width" />
  
  <rect x="50" y="50" width="{w}" height="{h}" 
        fill="#4285f4" stroke="#333" stroke-width="{strk}" rx="10" />
</svg>`);
    editor.updateOptions({ readOnly: false })
  }
})

tippy('#upload', {
  content: 'Upload a SVG file from local computer to edit',
  theme: 'editsvgcode'
});

tippy('#download', {
  content: 'Download the file to the local computer',
  theme: 'editsvgcode'
});

tippy('#save', {
  content: 'Save the contents of the file in the cloud',
  theme: 'editsvgcode'
})
