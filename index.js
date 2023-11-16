// *****************************************************
// <!-- Section 1 : Import Dependencies -->
// *****************************************************

const express = require('express'); // To build an application server or API
const app = express();
const pgp = require('pg-promise')(); // To connect to the Postgres DB from the node server
const bodyParser = require('body-parser');
const session = require('express-session'); // To set the session object. To store or access session data, use the `req.session`, which is (generally) serialized as JSON by the store.
const bcrypt = require('bcrypt'); //  To hash passwords
const axios = require('axios'); // To make HTTP requests from our server. We'll learn more about it in Part B.

// *****************************************************
// <!-- Section 2 : Connect to DB -->
// *****************************************************

// database configuration
const dbConfig = {
  host: 'db', // the database server
  port: 5432, // the database port
  database: process.env.POSTGRES_DB, // the database name
  user: process.env.POSTGRES_USER, // the user account to connect with
  password: process.env.POSTGRES_PASSWORD, // the password of the user account
};

const db = pgp(dbConfig);

// test your database
db.connect()
  .then(obj => {
    console.log('Database connection successful'); // you can view this message in the docker compose logs
    obj.done(); // success, release the connection;
  })
  .catch(error => {
    console.log('ERROR:', error.message || error);
  });

// *****************************************************
// <!-- Section 3 : App Settings -->
// *****************************************************

app.set('view engine', 'ejs'); // set the view engine to EJS
app.use(bodyParser.json()); // specify the usage of JSON for parsing request body.

// initialize session variables
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    saveUninitialized: false,
    resave: false,
  })
);

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

// *****************************************************
// <!-- Section 4 : API Routes -->
// *****************************************************

const user = {
    username: undefined,
    password: undefined,
  };

app.get("/", (req, res) =>{
    res.redirect('/register');
});

app.get("/login", (req,res) =>{
    res.render('pages/login');
});

app.get("/register", (req,res) =>{
    res.render('pages/register');
});

// Register
app.post('/register', async (req, res) => {
  //hash the password using bcrypt library
  const hash = await bcrypt.hash(req.body.password, 10);

  // To-DO: Insert username and hashed password into the 'users' table

  let query = `INSERT INTO users(username, password) VALUES ('${req.body.username}','${hash}')`;
  db.any(query)
  .then(_ => {
    console.log('data added');
    res.redirect('/login');
  })
  .catch(err => {
    console.log('error');
      res.redirect('/register');
  });
});

app.post('/login', async (req,res)=>{
    let query = `SELECT * FROM users WHERE users.username = '${req.body.username}'`;
    await db.one(query, req.body.username) 
    .then((data)=>{
        user.username = data.username;
        user.password = data.password;
    })

    .catch((err) => {
      //if user isnt in database
        if(user.password == undefined){
            res.redirect('/register');
            return;
        }
        else{
        res.render('pages/login',{
          //if cannot populate db
            error:true,
            message: "Unable to populate database"
        });}
    });


    if(user.password != undefined){
        const match = await bcrypt.compare(req.body.password, user.password);
        if(match == true){
          //if match for login
        req.session.user = user;
        req.session.save();
        res.redirect('/discover');
        }
        else{
          //if not match for login
        res.render('pages/login',{
          error:true,
          message: "Incorrect password"
        });
        };
    }
});

// Authentication Middleware.
const auth = (req, res, next) => {
    if (!req.session.user) {
      // Default to login page.
      return res.redirect('/login');
    }
    next();
  };
  
  // Authentication Required
  app.use(auth);


  app.get('/discover', (req, res) => {
    axios({
      url: `https://app.ticketmaster.com/discovery/v2/events.json`,
      method: 'GET',
      dataType: 'json',
      headers: {
        'Accept-Encoding': 'application/json',
      },
      params: {
        apikey: process.env.API_KEY,
        keyword: 'Denver Nuggets', //you can choose any artist/event here
        size: 10 // you can choose the number of events you would like to return
      },
    })
      .then(results => {
        console.log(results.data); // the results will be displayed on the terminal if the docker containers are running // Send some parameters
        res.render('pages/discover', {
          events: results.data._embedded.events});
      })
      .catch(error => {
        // Handle errors
        res.render('pages/discover',{
          error:true,
          message: "Could not find results",
          results: []
        });
      });
    });

    app.get('/logout', (req, res) => {
      req.session.destroy();
      
      res.render('pages/login',{
        error:false,
        message: "Logged out successfully!"
      });
    });
  

// *****************************************************
// <!-- Section 5 : Start Server-->
// *****************************************************
// starting the server and keeping the connection open to listen for more requests
app.listen(3000);
console.log('Server is listening on port 3000');