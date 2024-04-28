const express = require('express');
const router = express.Router();
const connection = require('../database'); // Import database connection

// REGISTER PAGE
router.get('/register', (req, res) => {
    // Initialize errorMessage
    const errorMessage = '';

    // Get displayName from session or set default value
    const displayName = req.session.displayName || '';

    // Get email from session or set default value
    const email = req.session.email || '';

    // Clear session variables after using them
    req.session.displayName = '';
    req.session.email = '';

    // Render the register page with required variables
    res.render("account/register", { isAuthenticated: req.session.authenticated, errorMessage, displayName, email });
});



// REGISTER
router.post('/register', (req, res) => {
    const { displayName, email, password } = req.body;

    req.session.displayName = displayName;
    req.session.email = email;

    // Check if displayName already exists in the database
    const checkDisplayNameQuery = 'SELECT * FROM users WHERE displayName = ?';
    connection.query(checkDisplayNameQuery, [displayName], (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Registration failed. Please try again.');
        }

        // Check if displayName already exists
        if (rows.length > 0) {
            const errorMessage = 'Display Name already in use.';
            // Pass displayName and email to retain entered values
            return res.render('account/register', { isAuthenticated: req.session.authenticated, errorMessage, displayName, email });
        }

        // Proceed to check email
        const checkEmailQuery = 'SELECT * FROM users WHERE email = ?';
        connection.query(checkEmailQuery, [email], (err, rows) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Registration failed. Please try again.');
            }

            // Check if email already exists
            if (rows.length > 0) {
                const errorMessage = 'Email address already registered.';
                // Pass displayName and email to retain entered values
                return res.render('account/register', { isAuthenticated: req.session.authenticated, errorMessage, displayName, email });
            }

            // If neither displayName nor email exists, proceed to insert new user
            const insertUserQuery = 'INSERT INTO users (displayName, email, password) VALUES (?, ?, ?)';
            connection.query(insertUserQuery, [displayName, email, password], (err, result) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send('Registration failed. Please try again.');
                }
                console.log('Registration successful!');
                res.redirect('/account/sign-in');
            });
        });
    });
});

// SIGN-IN PAGE
router.get('/sign-in', (req, res) => {

    res.render("account/sign-in", { isAuthenticated: req.session.authenticated })
});

// SIGN-IN PAGE
router.get('/logout', (req, res) => {
    req.session.authenticated = false;
    res.redirect('/');
});

// SETTINGS PAGE
router.get('/settings', (req, res) => {

    if (req.session.authenticated) {
        console.log('Authenticated session detected');
        const uid = req.session.user;
        const user = `SELECT * FROM users WHERE user_ID = "${uid}" `;

        connection.query(user, (err, row) => {
            const firstrow = row[0];
            res.render('dashboard', { isAuthenticated: req.session.authenticated, userdata: firstrow });
        });
    } else {
        console.log('Unauthorized access to settings page.');
        res.status(403).send('Unauthorized');
    }
});


// SIGN-IN
router.post('/sign-in', (req, res) => {
    const useremail = req.body.email;
    console.log(useremail);
    console.log(req.session);

    const checkuser = `SELECT * FROM users WHERE email = "${useremail}" `;

    connection.query(checkuser, (err, rows) => {
        if (err) throw err;
        const numRows = rows.length;

        console.log('Matching user profiles: ', rows)

        if (numRows > 0) {
            console.log('User exists on row: ', rows[0].user_ID);

            req.session.authenticated = true;
            req.session.user = rows[0].user_ID;

            console.log('Login Successful: ', req.session);
            console.log('end of session');
            res.redirect('/');
        } else {
            console.log('Login Unsuccessful');
            res.redirect('/');
        }
    });
});

module.exports = router;