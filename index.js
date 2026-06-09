const app = require('express')();
const port = 3000;

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

app.get('/number1', (req, res) => {
  res.status(200).send(
    {
      number: 1
    }
  );
});