const https = require('https');

const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
const COLLPRO_TEAM_ID = '8f22451f-f606-401d-aa3f-e9314267ab8f';
const TODO_STATE_ID = 'a95e908b-7e8f-4cd4-a8f7-8821613787d9';

async function createLinearTask(title, description, priority = 'Media', dueDate = null, assigneeId = null) {
  if (!LINEAR_API_KEY) {
    throw new Error('Falta LINEAR_API_KEY en variables de entorno');
  }

  const escapedTitle = title.replace(/"/g, '\\"').replace(/\n/g, ' ');
  const escapedDesc = description.replace(/"/g, '\\"');

  const priorityNum = getPriorityNum(priority);
  const dueDateStr = dueDate ? `dueDate: "${dueDate}"` : '';
  const assigneeStr = assigneeId ? `assigneeId: "${assigneeId}"` : '';

  const query = `mutation {
    issueCreate(input: {
      teamId: "${COLLPRO_TEAM_ID}"
      stateId: "${TODO_STATE_ID}"
      title: "${escapedTitle}"
      description: "${escapedDesc}"
      priority: ${priorityNum}
      ${dueDateStr}
      ${assigneeStr}
    }) {
      success
      issue {
        id
        identifier
        title
        url
      }
    }
  }`;

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ query });
    const options = {
      hostname: 'api.linear.app',
      path: '/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': LINEAR_API_KEY,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.errors) {
            reject(new Error(result.errors[0].message));
          } else if (result.data && result.data.issueCreate && result.data.issueCreate.issue) {
            resolve(result.data.issueCreate.issue);
          } else {
            reject(new Error('Respuesta inesperada de Linear API'));
          }
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function getPriorityNum(priority) {
  const map = { 'Urgente': 4, 'Alta': 3, 'Media': 2, 'Baja': 1 };
  return map[priority] || 2;
}

module.exports = { createLinearTask };
