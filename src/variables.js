export function parseVariables(xml) {
    const variables = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "image/svg+xml");
    const ns = "http://editsvgcode.com";
    const variableTags = doc.getElementsByTagNameNS(ns, "variable");

    Array.from(variableTags).forEach(el => {
        const name = el.getAttribute("name");
        if (name) {
            variables.push({
                name: name,
                value: parseFloat(el.getAttribute("value")) || 0,
                min: parseFloat(el.getAttribute("min")) || 0,
                max: parseFloat(el.getAttribute("max")) || 100,
                step: parseFloat(el.getAttribute("step")) || 1,
                type: el.getAttribute("type") || 'slider',
                attack: parseFloat(el.getAttribute("attack")) || 0.1,
                decay: parseFloat(el.getAttribute("decay")) || 0.5,
                label: el.getAttribute("label") || name
            });
        }
    });
    return variables;
}

export function substituteVariables(xml, variables) {
    let processedXml = xml;
    variables.forEach(v => {
        const regex = new RegExp(`\\{${v.name}\\}`, 'g');
        processedXml = processedXml.replace(regex, v.currentValue !== undefined ? v.currentValue : v.value);
    });
    return processedXml;
}
