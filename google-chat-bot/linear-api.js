const https = require('https');

const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
const LINEAR_TEAM_ID = process.env.LINEAR_TEAM_ID;

async function createLinearTask(title, description, priority = 'Media', dueDate = null) {
  if (!LINEAR_API_KEY || !LINEAR_TEAM_ID) {
    throw new Error('Falta LINEAR_API_KEY o LINEAR_TEAM_ID');
  }

  const escapedTitle = title.replace(/"/g, '\\"');
  const escapedDesc = description.replace(/"/g, '\\"');

  const query = `mutation {
    issueCreate(input: {
      teamId: "${LINEAR_TEAM_ID}"
      title: "${escapedTitle}"
      description: "${escapedDesc}"
      priority: ${getPriorityNum(priority)}
      ${dueDate ? `dueDate: "${dueDate}"` : ''}
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
          } else {
            resolve(result.data.issueCreate.issue);
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
