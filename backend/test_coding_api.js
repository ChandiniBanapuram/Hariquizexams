// Using built-in fetch (Node 18+)

async function testAPI() {
  const baseUrl = 'http://localhost:5000/api/coding';
  
  console.log('--- Testing POST /practice/questions ---');
  const addRes = await fetch(`${baseUrl}/practice/questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Test Arrays',
      description: 'Sum of array elements',
      difficulty: 'Easy',
      topic: 'Arrays',
      input_format: 'n numbers',
      output_format: 'sum',
      visible_test_cases: [{ input: '1 2 3', output: '6' }],
      hidden_test_cases: [{ input: '10 20', output: '30' }]
    })
  });
  const addData = await addRes.json();
  console.log('Add Response:', addData);

  console.log('\n--- Testing GET /practice/questions ---');
  const getRes = await fetch(`${baseUrl}/practice/questions?difficulty=Easy&topic=Arrays`);
  const getData = await getRes.json();
  console.log('Get Response Count:', getData.questions?.length);
  if (getData.questions?.length > 0) {
    console.log('First Question Title:', getData.questions[0].title);
  }
}

testAPI();
