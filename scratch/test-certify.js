const url = 'http://localhost:3000/api/purchase/certify';

async function test() {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      txHash: '0x123',
      tier: 2,
      contentId: 5,
      buyerAddress: '0x9e302a0da809a6d600b8d9324bc1e905937a6dd7506231f54c21550fb8a34654',
      amount: 5000000
    })
  });
  const text = await res.text();
  console.log('STATUS:', res.status);
  console.log('RESPONSE:', text);
}

test().catch(console.error);
