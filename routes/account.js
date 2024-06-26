const express = require('express');
const router = express.Router();
const connection = require('../database'); // Import database connection
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');

// REGISTER PAGE
router.get('/register', (req, res) => {
    // Initialize blank error message
    const errorMessage = '';
    res.render("account/register", {
        attemptedDisplayName: req.body.displayName,
        attemptedEmail: req.body.email,
        user: req.session.user,
        displayName: req.session.displayName,
        errorMessage
    });
});

// REGISTER
router.post('/register', [
    body('displayName').trim().isLength({ min: 5, max: 10 }).withMessage('Display Name must be 5 to 10 characters long.'),
    body('email').trim().isEmail().normalizeEmail().withMessage('Invalid email format.'),
    body('password').trim().isLength({ min: 8 }).withMessage('Password must be 8 characters or more.')
], async (req, res) => {

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const errorMessage = errors.array()[0].msg;
        return res.render('account/register', {
            attemptedDisplayName: req.body.displayName,
            attemptedEmail: req.body.email,
            user: req.session.user, displayName:
                req.session.displayName,
            errorMessage
        });
    }

    const { displayName, email, password } = req.body;

    // Check if displayName already exists in the database
    const checkDisplayNameQuery = `
    SELECT * 
    FROM users 
    WHERE displayName = ?`;
    connection.query(checkDisplayNameQuery, [displayName], async (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Internal Server Error');
        }

        // Check if displayName already exists
        if (rows.length > 0) {
            return res.render('account/register', {
                attemptedDisplayName: req.body.displayName,
                attemptedEmail: req.body.email,
                user: req.session.user,
                displayName: req.session.displayName,
                errorMessage: 'Display Name already in use.',
            });
        }

        // Proceed to check if email already exists in the database
        const checkEmailQuery = `
        SELECT * 
        FROM users 
        WHERE email = ?`;
        connection.query(checkEmailQuery, [email], async (err, rows) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }

            // Check if email already exists
            if (rows.length > 0) {
                return res.render('account/register', {
                    attemptedDisplayName: req.body.displayName,
                    attemptedEmail: req.body.email,
                    user: req.session.user,
                    displayName: req.session.displayName,
                    errorMessage: 'Email address already registered.',
                });
            }

            try {

                // Hash the password using bcrypt
                const hashedPassword = await bcrypt.hash(password, 10); // 10 is the saltRounds value

                // Insert new user
                const insertUserQuery = `
                INSERT INTO users (displayName, email, password) 
                VALUES (?, ?, ?)`;
                connection.query(insertUserQuery, [displayName, email, hashedPassword], async (err, userResult) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).send('Internal Server Error');
                    }

                    const userId = userResult.insertId;

                    // Create a new collection for the user
                    const insertCollectionQuery = `
                    INSERT INTO collection (name, user_id) 
                    VALUES (?, ?)`;
                    connection.query(insertCollectionQuery, ['My Collection', userId], async (err, collectionResult) => {
                        if (err) {
                            console.error(err);
                            return res.status(500).send('Internal Server Error');
                        }

                        // Create a new wishlist for the user
                        const insertWishlistQuery = `
                        INSERT INTO wishlist (user_id) 
                        VALUES (?)`;
                        connection.query(insertWishlistQuery, [userId], async (err, wishlistResult) => {
                            if (err) {
                                console.error(err);
                                return res.status(500).send('Internal Server Error');
                            }

                            // Registration successful
                            console.log('Registration Successful');
                            return res.render("account/sign-in", {
                                user: req.session.user,
                                displayName: req.session.displayName,
                                errorMessage: '',
                            });
                        });
                    });
                });

            } catch (error) {
                console.error('Error hashing password:', error);
                return res.render('account/register', {
                    attemptedDisplayName: req.body.displayName,
                    attemptedEmail: req.body.email,
                    user: req.session.user,
                    displayName: req.session.displayName,
                    errorMessage: 'Registration failed during password hashing. Please try again.'
                });
            }
        });
    });
});

// SIGN-IN PAGE
router.get('/sign-in', (req, res) => {

    res.render("account/sign-in", {
        user: req.session.user,
        displayName: req.session.displayName,
        errorMessage: '',
    })
});

//SIGN-IN
router.post('/sign-in', [
    body('email').isEmail().normalizeEmail().withMessage('Invalid email format.'),
    body('password').isLength({ min: 8 }).withMessage('Password must be 8 characters or more.')
], async (req, res) => {

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).render('account/sign-in', {
            user: req.session.user,
            displayName: req.session.displayName,
            errorMessage: errors.array()[0].msg
        });
    }

    const useremail = req.body.email;
    const userpassword = req.body.password;

    // Find user in database
    const checkUserQuery = `
    SELECT * 
    FROM users 
    WHERE email = ?`;
    connection.query(checkUserQuery, [useremail], async (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Internal Server Error');
        }

        // Check if user exists
        if (rows.length > 0) {
            // User found
            const hashedPasswordFromDB = rows[0].password;

            // Compare the entered password with the hashed password from the database
            try {
                const passwordMatch = await bcrypt.compare(userpassword, hashedPasswordFromDB);

                if (passwordMatch) {
                    // Successful login
                    req.session.user = rows[0].user_ID;
                    req.session.displayName = rows[0].displayName;
                    console.log('Successful login.')
                    return res.redirect('/dashboard');
                } else {
                    // Passwords do not match
                    return res.render("account/sign-in", {
                        user: req.session.user,
                        displayName: req.session.displayName,
                        errorMessage: 'Invalid password.',
                    });
                }
            } catch (error) {
                console.error('Error comparing passwords:', error);
                return res.render("account/sign-in", {
                    user: req.session.user,
                    displayName: req.session.displayName,
                    errorMessage: 'Login failed. Please try again.',
                });
            }
        } else {
            // User not found
            return res.render("account/sign-in", {
                user: req.session.user,
                displayName: req.session.displayName,
                errorMessage: 'User not found.',
            });
        }
    });
});

// LOGOUT
router.get('/logout', (req, res) => {

    if (!req.session.user) {
        console.log('Unauthorized access to page.');
        return res.status(403).send('You must be logged in to view this page.');
    }

    req.session.user = '';
    req.session.displayName = '';
    res.redirect('/');
});

// NOTIFICATIONS PAGE
router.get('/notifications', (req, res) => {

    if (!req.session.user) {
        console.log('Unauthorized access to page.');
        return res.status(403).send('You must be logged in to view this page.');
    }

    // Get the user's notifications
    const userNotificationSQL = `
    SELECT notification.id, notification.from_user_id, notification.to_user_id, notification.message, notification_type.value AS notification_type
    FROM notification 
    JOIN notification_type ON notification.notification_type_id = notification_type.id
    WHERE notification.to_user_id = ?`;
    connection.query(userNotificationSQL, [req.session.user], (err, userNotifications) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Internal Server Error');
        }

        // Update the status of notifications to 'read' in the database
        const notificationIds = userNotifications.map(notification => notification.id);
        if (notificationIds.length > 0) {
            const markAsReadSQL = `UPDATE notification SET notification_type_id = 1 WHERE id IN (?)`;
            connection.query(markAsReadSQL, [notificationIds], (updateErr, updateResult) => {
                if (updateErr) {
                    console.error('Error marking notifications as read:', updateErr);
                    // Handle the error if needed
                } else {
                    console.log('Notifications marked as read.');
                }
            });
        }

        res.render('account/notifications', {
            user: req.session.user,
            displayName: req.session.displayName,
            userNotifications,
        });
    });
});


// SETTINGS PAGE
router.get('/settings', (req, res) => {

    if (!req.session.user) {
        console.log('Unauthorized access to page.');
        return res.status(403).send('You must be logged in to view this page.');
    }

    const uid = req.session.user;
    const user = `
    SELECT * 
    FROM users 
    WHERE user_ID = "${uid}" `;
    connection.query(user, (err, row) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Internal Server Error');
        }

        const firstrow = row[0];
        res.render('account/settings', {
            user: req.session.user,
            displayName: req.session.displayName,
            userdata: firstrow,
            errorMessage: '',
            successMessage: '',
        });
    });

});

// UPDATE DISPLAY NAME
router.post('/update-display-name', [
    body('newDisplayName').trim().isLength({ min: 5, max: 10 }).withMessage('Display Name must be 5 to 10 characters long.'),
    body('currentPassword').trim().notEmpty().withMessage('Current Password is required.')
], async (req, res) => {

    if (!req.session.user) {
        console.log('Unauthorized access to page.');
        return res.status(403).send('You must be logged in to view this page.');
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // Validation errors
        renderSettingsWithError(req, res, errors.array()[0].msg, '');

    } else {
        const userId = req.session.user;
        const newDisplayName = req.body.newDisplayName;
        const currentPassword = req.body.currentPassword;

        // Check if the current password matches the user's actual password
        const checkPasswordQuery = 'SELECT * FROM users WHERE user_ID = ?';
        connection.query(checkPasswordQuery, [userId], async (err, rows) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }

            if (rows.length === 0) {
                // User not found
                renderSettingsWithError(req, res, 'User not found.', '');
            }

            const hashedPasswordFromDB = rows[0].password;

            // Compare the entered password with the hashed password from the database using bcrypt
            try {
                const passwordMatch = await bcrypt.compare(currentPassword, hashedPasswordFromDB);
                if (passwordMatch) {

                    // Check if the new display name already exists
                    const checkDisplayNameQuery = 'SELECT * FROM users WHERE displayName = ? AND user_ID != ?';
                    connection.query(checkDisplayNameQuery, [newDisplayName, userId], async (err, rows) => {
                        if (err) {
                            console.error(err);
                            return res.status(500).send('Internal Server Error');
                        }

                        if (rows.length > 0) {
                            // Display name already exists
                            renderSettingsWithError(req, res, 'Display name already exists.', '');

                        } else {
                            // Proceed with updating display name
                            const updateDisplayNameQuery = 'UPDATE users SET displayName = ? WHERE user_ID = ?';
                            connection.query(updateDisplayNameQuery, [newDisplayName, userId], (err, result) => {
                                if (err) {
                                    console.error(err);
                                    return res.status(500).send('Internal Server Error');
                                }

                                req.session.displayName = newDisplayName;
                                renderSettingsWithError(req, res, '', 'Display name updated successfully!');
                            });
                        }
                    });
                } else {
                    // Passwords do not match
                    renderSettingsWithError(req, res, 'Incorrect password.', '');
                }
            } catch (error) {
                // Error comparing passwords
                renderSettingsWithError(req, res, 'An error occurred. Please try again.', '');
            }
        });
    }
});

// CHANGE EMAIL
router.post('/update-email', [
    body('newEmail').trim().isEmail().normalizeEmail().withMessage('Invalid email format.'),
    body('currentPassword').trim().notEmpty().withMessage('Current Password is required.')
], async (req, res) => {

    if (!req.session.user) {
        console.log('Unauthorized access to page.');
        return res.status(403).send('You must be logged in to view this page.');
    }

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // Validation errors
        renderSettingsWithError(req, res, errors.array()[0].msg, '');
    } else {
        const userId = req.session.user;
        const newEmail = req.body.newEmail;
        const currentPassword = req.body.currentPassword;

        // Check if the current password matches the user's actual password
        const checkPasswordQuery = `
        SELECT * 
        FROM users 
        WHERE user_ID = ?`;
        connection.query(checkPasswordQuery, [userId], async (err, rows) => {
            if (err) {
                console.error('Error checking password:', err);
                return res.status(500).send('Error checking password');
            }

            if (rows.length === 0) {
                // User not found
                renderSettingsWithError(req, res, 'User not found.', '');
            }

            const hashedPasswordFromDB = rows[0].password;

            // Compare the entered password with the hashed password from the database using bcrypt
            try {
                const passwordMatch = await bcrypt.compare(currentPassword, hashedPasswordFromDB);
                if (passwordMatch) {

                    // Check if the new email already exists
                    const checkEmailQuery = 'SELECT * FROM users WHERE email = ? AND user_ID != ?';
                    connection.query(checkEmailQuery, [newEmail, userId], (err, rows) => {
                        if (err) {
                            console.error('Error checking email:', err);
                            return res.status(500).send('Error checking email');
                        }

                        if (rows.length > 0) {
                            // Email already exists
                            renderSettingsWithError(req, res, 'Email address already in use.', '');
                        } else {
                            // Proceed with updating email in the database
                            const updateEmailQuery = 'UPDATE users SET email = ? WHERE user_ID = ?';
                            connection.query(updateEmailQuery, [newEmail, userId], (err, result) => {
                                if (err) {
                                    console.error('Error updating email:', err);
                                    return res.status(500).send('Failed to update email');
                                }
                                renderSettingsWithError(req, res, '', 'Email updated successfully!');
                            });
                        }
                    });
                } else {
                    // Passwords do not match
                    renderSettingsWithError(req, res, 'Incorrect password.', '');
                }
            } catch (error) {
                // Error comparing passwords
                renderSettingsWithError(req, res, 'An error occurred. Please try again.', '');
            }
        });
    }
});

// UPDATE PASSWORD
router.post('/update-password', [
    body('currentPassword').trim().notEmpty().withMessage('Current Password is required.'),
    body('newPassword').isLength({ min: 8 }).withMessage('Password must be 8 characters or more.')
], async (req, res) => {

    if (!req.session.user) {
        console.log('Unauthorized access to page.');
        return res.status(403).send('You must be logged in to view this page.');
    }

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // Validation errors
        renderSettingsWithError(req, res, errors.array()[0].msg, '');

    } else {
        const userId = req.session.user;
        const currentPassword = req.body.currentPassword;
        const newPassword = req.body.newPassword;

        // Check if the current password matches the user's actual password
        const checkPasswordQuery = 'SELECT * FROM users WHERE user_ID = ?';
        connection.query(checkPasswordQuery, [userId], async (err, rows) => {
            if (err) {
                console.error('Error checking password:', err);
                return res.status(500).send('Error checking password');
            }
            if (rows.length === 0) {
                // User not found
                renderSettingsWithError(req, res, 'User not found.', '');
            };

            const hashedPasswordFromDB = rows[0].password;

            // Compare the entered password with the hashed password from the database using bcrypt
            try {
                const passwordMatch = await bcrypt.compare(currentPassword, hashedPasswordFromDB);
                if (passwordMatch) {
                    // Hash the new password before updating in the database
                    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

                    // Proceed with updating password in the database
                    const updatePasswordQuery = 'UPDATE users SET password = ? WHERE user_ID = ?';
                    connection.query(updatePasswordQuery, [hashedNewPassword, userId], (err, result) => {
                        if (err) {
                            console.error('Error updating password:', err);
                            return res.status(500).send('Failed to update password');
                        }
                        renderSettingsWithError(req, res, '', 'Password updated successfully!');
                    });

                } else {
                    // Passwords do not match
                    renderSettingsWithError(req, res, 'Incorrect password.', '');

                }
            } catch (error) {
                // Error comparing passwords
                renderSettingsWithError(req, res, 'An error occurred. Please try again.', '');

            }
        });
    }
});

// ERASE DATA
router.post('/erase-data', [
    body('currentPassword').trim().notEmpty().withMessage('Current Password is required.'),
], async (req, res) => {

    if (!req.session.user) {
        console.log('Unauthorized access to page.');
        return res.status(403).send('You must be logged in to view this page.');
    }

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // Validation errors
        renderSettingsWithError(req, res, errors.array()[0].msg, '');

    } else {
        const userId = req.session.user;
        const currentPassword = req.body.currentPassword;
        const eraseCollectionCheck = req.body.eraseCollectionsCheck;
        const eraseWishlistCheck = req.body.eraseWishlistCheck;

        // Check if the current password matches the user's actual password
        const checkPasswordQuery = `
        SELECT * 
        FROM users 
        WHERE user_ID = ?`;
        connection.query(checkPasswordQuery, [userId], async (err, rows) => {
            if (err) {
                console.error('Error checking password:', err);
                return res.status(500).send('Error checking password');
            }
            if (rows.length === 0) {
                // User not found
                renderSettingsWithError(req, res, 'User not found.', '');
            };

            const hashedPasswordFromDB = rows[0].password;

            // Compare the entered password with the hashed password from the database using bcrypt
            try {
                const passwordMatch = await bcrypt.compare(currentPassword, hashedPasswordFromDB);
                if (!passwordMatch) {
                    return renderSettingsWithError(req, res, 'Incorrect password.', '');
                }

                // Define promises for collection and wishlist deletion
                const deleteCollectionPromise = new Promise((resolve, reject) => {
                    if (eraseCollectionCheck === 'on') {
                        const deleteCollectionSQL = `
                        DELETE FROM collections_cards 
                        WHERE collection_ID IN (SELECT id FROM collection WHERE user_id = ?)`;
                        connection.query(deleteCollectionSQL , [userId], (err, result) => {
                            if (err) {
                                console.error('Error deleting collection:', err);
                                reject(err);
                            } else {
                                console.log('Collection deleted successfully');
                                resolve();
                            }
                        });
                    } else {
                        resolve(); // Resolve immediately if no collection deletion is requested
                    }
                });

                const deleteWishlistPromise = new Promise((resolve, reject) => {
                    if (eraseWishlistCheck === 'on') {
                        const deleteWishListSQL = `
                        DELETE FROM wishlist_cards 
                        WHERE wishlist_id IN (SELECT id FROM wishlist WHERE user_id = ?)`;
                        connection.query(deleteWishListSQL, [userId], (err, result) => {
                            if (err) {
                                console.error('Error deleting wishlist:', err);
                                reject(err);
                            } else {
                                console.log('Wishlist deleted successfully');
                                resolve();
                            }
                        });
                    } else {
                        resolve(); // Resolve immediately if no wishlist deletion is requested
                    }
                });

                // Wait for both promises to resolve
                Promise.all([deleteCollectionPromise, deleteWishlistPromise])
                    .then(() => {
                        renderSettingsWithError(req, res, '', 'Data deleted successfully');
                    })
                    .catch((err) => {
                        console.error('Error deleting data:', err);
                        renderSettingsWithError(req, res, 'Error deleting data. Please try again.', '');
                    });

            } catch (error) {
                console.error('Error comparing passwords:', error);
                renderSettingsWithError(req, res, 'An error occurred. Please try again.', '');
            }
        });
    }
});

// CLOSE ACCOUNT
router.post('/close-account', [
    body('currentPassword').trim().notEmpty().withMessage('Current Password is required.'),
], async (req, res) => {

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // Validation errors
        renderSettingsWithError(req, res, errors.array()[0].msg, '');

    } else {
        const userId = req.session.user;
        const currentPassword = req.body.currentPassword;

        // Check if the current password matches the user's actual password
        const checkPasswordQuery = `
        SELECT * 
        FROM users WHERE user_ID = ?`;
        connection.query(checkPasswordQuery, [userId], async (err, rows) => {
            if (err) {
                console.error('Error checking password:', err);
                return res.status(500).send('Error checking password');
            }
            if (rows.length === 0) {
                // User not found
                renderSettingsWithError(req, res, 'User not found.', '');
            };

            const hashedPasswordFromDB = rows[0].password;

            // Compare the entered password with the hashed password from the database using bcrypt
            try {
                const passwordMatch = await bcrypt.compare(currentPassword, hashedPasswordFromDB);
                if (passwordMatch) {
                    deleteUserAccountSQL = `
                    DELETE FROM users 
                    WHERE user_id = ?`;
                    connection.query(deleteUserAccountSQL, [userId], (err, result) => {
                        if (err) {
                            console.error('Error deleting account:', err);
                            return res.status(500).send('Error deleting account');
                        }

                        req.session.user = undefined; // Set user ID to undefined
                        req.session.displayname = undefined; // Set displayname to undefined

                        console.log('Account deleted.');

                        res.redirect('/'); // Send the user home
                    })

                } else {
                    // Passwords do not match
                    renderSettingsWithError(req, res, 'Incorrect password.', '');

                }
            } catch (error) {
                // Error comparing passwords
                renderSettingsWithError(req, res, 'An error occurred. Please try again.', '');

            }
        });
    }
});

// Function to query user details and render settings page with error message
function renderSettingsWithError(req, res, errorMessage, successMessage) {
    const userQuery = `SELECT * FROM users WHERE user_ID = "${req.session.user}" `;
    connection.query(userQuery, (err, row) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Internal Server Error');
        }

        const firstrow = row[0];
        return res.status(500).render('account/settings', {
            user: req.session.user,
            displayName: req.session.displayName,
            userdata: firstrow,
            errorMessage,
            successMessage
        });
    });
}

module.exports = router;