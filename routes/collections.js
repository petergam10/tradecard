const express = require('express');
const router = express.Router();
const connection = require('../database'); // Import database connection
const { body, validationResult } = require('express-validator');

// MY COLLECTIONS
router.get('/my-collections', (req, res) => {

    if (!req.session.user) {
        console.log('Unauthorized access to page.');
        return res.status(403).send('You must be logged in to view this page.');
    }

    const errorMessage = '';
    const userId = req.session.user;

    const userCollectionsSQL = `SELECT * FROM collection WHERE user_id = ?`
    connection.query(userCollectionsSQL, [userId], (err, userCollections) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Internal Server Error');
        }

        res.render('collections/my-collections', {
            user: req.session.user,
            displayName: req.session.displayName,
            collectionList: userCollections,
            errorMessage,
        });
    })
});


// ADD COLLECTION
router.post('/add-collection', [
    body('newCollectionName').trim().isLength({ min: 5, max: 50 }).withMessage('Collection name must be 5 to 50 characters long.'),
], (req, res) => {
    const { newCollectionName } = req.body;

    if (!req.session.user) {
        console.log('Unauthorized access to page.');
        return res.status(403).send('You must be logged in to view this page.');
    }

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const errorMessage = errors.array()[0].msg;
        return renderMyCollectionsWithError(req, res, errorMessage);
    }

    // Check if collection name already exists
    const checkCollectionNameSQL = `SELECT * FROM collection WHERE name = ? AND user_id = ?`;
    connection.query(checkCollectionNameSQL, [newCollectionName, req.session.user], (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error checking collection name');
        }

        // Collection Name Already Exists
        if (rows.length > 0) {
            return renderMyCollectionsWithError(req, res, 'Collection name already exists.');
        }

        // Insert New Collection
        const insertCollectionSQL = `INSERT INTO collection (name, user_id) VALUES (?, ?)`;
        connection.query(insertCollectionSQL, [newCollectionName, req.session.user], (err, result) => {
            if (err) {
                console.error('Error inserting collection:', err);
                return res.status(500).send('Error inserting collection');
            }

            console.log('New collection creation successful');
            // Render my-collections after successful insertion
            return renderMyCollectionsWithError(req, res, '');
        });
    });
});

// DELETE COLLECTION
router.post('/delete-collection', (req, res) => {
    const collectionIdToDelete = req.body.collectionId;

    if (!req.session.user) {
        console.log('Unauthorized access to page.');
        return res.status(403).send('You must be logged in to view this page.');
    }

    // Check if the user owns the collection (optional, depending on your logic)
    const checkOwnershipSQL = `SELECT * FROM collection WHERE id = ? AND user_id = ?`;
    connection.query(checkOwnershipSQL, [collectionIdToDelete, req.session.user], (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error checking collection ownership');
        }

        if (rows.length === 0) {
            return res.status(403).send('You are not authorized to delete this collection.');
        }

        // Delete the collection
        const deleteCollectionSQL = `DELETE FROM collection WHERE id = ?`;
        connection.query(deleteCollectionSQL, [collectionIdToDelete], (err, result) => {
            if (err) {
                console.error('Error deleting collection:', err);
                return res.status(500).send('Error deleting collection');
            }

            console.log('Collection deleted successfully');
            // Render my-collections after successful insertion
            return renderMyCollectionsWithError(req, res, '');
        });
    });
});

// ADD RATING TO COLLECTION
router.post('/add-collection-rating', [], (req, res) => {

    if (!req.session.user) {
        console.log('Unauthorized access to page.');
        return res.status(403).send('You must be logged in to view this page.');
    }

    const { collectionID, collectionRating } = req.body;
    const userId = req.session.user;

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const errorMessage = errors.array()[0].msg;
        return renderMyCollectionsWithError(req, res, errorMessage);
    }

    const addRatingSQL = `
    INSERT INTO rating (value, user_id, collection_id) 
    VALUES (?, ?, ?) 
    ON DUPLICATE KEY UPDATE value = VALUES(value)`;
    connection.query(addRatingSQL, [collectionRating, userId, collectionID], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Internal Server Error');
        }
        console.log('Rating Added');

        // Get info for notification
        const notificationInfoSQL = `
        SELECT collection.id, collection.name, users.user_ID
        FROM collection
        JOIN users ON collection.user_id = users.user_ID
        WHERE collection.id = ?`
        connection.query(notificationInfoSQL, [collectionID], (err, notificationInfo) => {
            if (err) {
                console.error('Error adding comment:', err);
                return res.status(500).json({ success: false, message: 'Failed to add comment' });
            }

            // Add notification for user
            const addNotificationSQL = `
            INSERT INTO notification (notification_type_id, from_user_id, to_user_id, message)
            VALUES (2, ?, ?, ?)`
            connection.query(addNotificationSQL, [userId, notificationInfo[0].user_ID, `A user has just added a rating to your collection: '${notificationInfo[0].name}'`], (err, result) => {
                if (err) {
                    console.error('Error adding comment:', err);
                    return res.status(500).json({ success: false, message: 'Failed to add comment' });
                }

                console.log('Notification added')

                res.redirect(`/collections/${collectionID}`);
            })
        })
    })
});

// ADD COMMENT TO COLLECTION
router.post('/add-comment', (req, res) => {

    if (!req.session.user) {
        console.log('Unauthorized access to page.');
        return res.status(403).send('You must be logged in to view this page.');
    }

    const { commentText, userId, collectionId } = req.body;

    // Insert the comment into the database
    const insertCommentQuery = `
    INSERT INTO comments (user_id, collection_id, text, created_at) 
    VALUES (?, ?, ?, NOW())`;
    connection.query(insertCommentQuery, [userId, collectionId, commentText], (err, result) => {
        if (err) {
            console.error('Error adding comment:', err);
            return res.status(500).json({ success: false, message: 'Failed to add comment' });
        }
        console.log('Comment Added');

        // Get info for notification
        const notificationInfoSQL = `
        SELECT collection.id, collection.name, users.user_ID
        FROM collection
        JOIN users ON collection.user_id = users.user_ID
        WHERE collection.id = ?`
        connection.query(notificationInfoSQL, [collectionId], (err, notificationInfo) => {
            if (err) {
                console.error('Error adding comment:', err);
                return res.status(500).json({ success: false, message: 'Failed to add comment' });
            }

            // Add notification for user
            const addNotificationSQL = `
            INSERT INTO notification (notification_type_id, from_user_id, to_user_id, message)
            VALUES (2, ?, ?, ?)`
            connection.query(addNotificationSQL, [userId, notificationInfo[0].user_ID, `A user has just added a comment to your collection: '${notificationInfo[0].name}'`], (err, result) => {
                if (err) {
                    console.error('Error adding comment:', err);
                    return res.status(500).json({ success: false, message: 'Failed to add comment' });
                }

                console.log('Notification added')

                res.redirect(`/collections/${collectionId}`);

            })
        })
    });
});

// BROWSE COLLECTIONS
router.get('/browse', (req, res) => {

    // Get all collections
    const collectionsSQL = `
    SELECT collection.*, users.displayName AS ownerDisplayName, AVG(rating.value) AS averageRating
    FROM collection
    JOIN users ON collection.user_id = users.user_ID
    LEFT JOIN rating ON collection.id = rating.collection_id
    GROUP BY collection.id, users.displayName`;
    connection.query(collectionsSQL, (err, userCollections) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Internal Server Error');
        }

        res.render('collections/collections', {
            user: req.session.user,
            displayName: req.session.displayName,
            collectionList: userCollections,
            errorMessage: '',
        });
    })
});

// VIEW WISHLIST
router.get('/wishlist', (req, res) => {

    if (!req.session.user) {
        console.log('Unauthorized access to page.');
        return res.status(403).send('You must be logged in to view this page.');
    }

    const page = parseInt(req.query.page) || 1;     // Default to page 1 if no query param provided
    const limit = parseInt(req.query.limit) || 25;  // Default to 20 if no query param provided
    const offset = (page - 1) * limit;              // Calculate the offset based on the page and limit
    const sort = req.query.sort || 'name ASC';      // Default sort to Series_ID

    let userWishlist = [];

    // Get wishlist ID
    const wishlistIdSQL = `
    SELECT id 
    FROM wishlist 
    WHERE user_id = ?`
    connection.query(wishlistIdSQL, [req.session.user], (err, wishlistID) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Internal Server Error');
        }

        // Get all cards in wishlist
        let allWishlistCardsSQL = `
        SELECT * 
        FROM cards 
        WHERE id IN (SELECT card_ID FROM wishlist_cards WHERE wishlist_id = ?)`;
        connection.query(allWishlistCardsSQL, [wishlistID[0].id], (err, allWishlistCards) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }

            const totalRecords = allWishlistCards.length;
            const totalPages = Math.ceil(totalRecords / limit);

            // Get paginated cards in wishlist
            let wishlistCardsSQL = `
            SELECT * 
            FROM cards 
            WHERE id IN (SELECT card_ID FROM wishlist_cards WHERE wishlist_id = ?) 
            ORDER BY ${sort} LIMIT ? OFFSET ?`;
            connection.query(wishlistCardsSQL, [wishlistID[0].id, limit, offset], (err, wishlistCards) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send('Internal Server Error');
                }

                // Get collection_cards from the users collection using collection id
                let UserwishlistCardsSQL = `
                 SELECT collections_cards.card_ID
                 FROM collections_cards 
                 JOIN collection ON collections_cards.collection_ID = collection.id 
                 JOIN users ON collection.user_id = users.user_ID 
                 WHERE users.user_ID = ?`;
                connection.query(UserwishlistCardsSQL, [req.session.user], (err, UserwishlistCards) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).send('Internal Server Error');
                    }
                    const userCollection = UserwishlistCards.map(card => card.card_ID);

                    const userWishlist = allWishlistCards.map(card => card.id);

                    res.render('collections/wishlist', {
                        user: req.session.user,
                        displayName: req.session.displayName,
                        userCollection,
                        userWishlist,
                        cardsList: allWishlistCards,
                        limit,
                        currentSort: sort,
                        currentPage: page,
                        totalPages,
                        totalRecords,
                    });

                });
            })
        })
    })
});

// VIEW COLLECTION
router.get('/:collectionID', (req, res) => {

    const collectionID = req.params.collectionID;   // Get the collection ID from URL params
    const page = parseInt(req.query.page) || 1;     // Default to page 1 if no query param provided
    const limit = parseInt(req.query.limit) || 25;  // Default to 20 if no query param provided
    const offset = (page - 1) * limit;              // Calculate the offset based on the page and limit
    const sort = req.query.sort || 'name ASC';      // Default sort to Series_ID

    let userCollection = [];
    let userWishlist = [];
    let userCollectionRating = null;

    // Get specific collection
    const collectionSQL = `
    SELECT collection.*, users.displayName AS ownerDisplayName, AVG(rating.value) AS averageRating
    FROM collection
    JOIN users ON collection.user_id = users.user_ID
    LEFT JOIN rating ON collection.id = rating.collection_id
    WHERE collection.id = ?
    GROUP BY collection.id, users.displayName`;
    connection.query(collectionSQL, [collectionID], (err, collection) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Internal Server Error');
        }

        // Get comments from specific collection
        let collectionCommentsSQL = `
        SELECT comments.*, users.displayName AS ownerDisplayName
        FROM  comments 
        JOIN users ON comments.user_ID = users.user_ID
        WHERE collection_ID = ?`
        connection.query(collectionCommentsSQL, [collectionID], (err, collectionComments) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }

            // Get all cards from specific collection
            let allCardsSQL = `
            SELECT * 
            FROM cards 
            WHERE id IN (SELECT card_ID FROM collections_cards 
            WHERE collection_ID = ? )`;
            connection.query(allCardsSQL, [collectionID], (err, allCards) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send('Internal Server Error');
                }

                const totalRecords = allCards.length;
                const totalPages = Math.ceil(totalRecords / limit);

                // Get paginated cards with limit and offset
                let cardsSQL = `
                SELECT * 
                FROM cards 
                WHERE id IN (SELECT card_ID FROM collections_cards WHERE collection_ID = ? ) 
                ORDER BY ${sort} LIMIT ? OFFSET ?`;
                connection.query(cardsSQL, [collectionID, limit, offset], (err, collectionCards) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).send('Internal Server Error');
                    }

                    if (req.session.user) {
                        // Get users rating value for collection
                        const userCollectionRatingSQL = `SELECT value FROM rating where collection_id = ? AND user_id = ?`;
                        connection.query(userCollectionRatingSQL, [collectionID, req.session.user], (err, userCollectionRating) => {
                            if (err) {
                                console.error(err);
                                return res.status(500).send('Internal Server Error');
                            }
                            // Get collection_cards from the users collection using collection id
                            let UserCollectionCardsSQL = `
                            SELECT * 
                            FROM collections_cards 
                            JOIN collection ON collections_cards.collection_ID = collection.id 
                            JOIN users ON collection.user_id = users.user_ID 
                            WHERE users.user_ID = ?`;
                            connection.query(UserCollectionCardsSQL, [req.session.user], (err, UserCollectionCards) => {
                                if (err) {
                                    console.error(err);
                                    return res.status(500).send('Internal Server Error');
                                }
                                const userCollection = UserCollectionCards.map(card => card.card_ID);

                                // Get card ids in users wishlist
                                let userWishlistSQL = `
                                SELECT wishlist_cards.card_id 
                                FROM wishlist_cards 
                                JOIN wishlist ON wishlist_cards.wishlist_id = wishlist.id
                                WHERE wishlist.user_id = ?`;
                                connection.query(userWishlistSQL, [req.session.user], (err, userWishlistCards) => {
                                    if (err) {
                                        console.error(err);
                                        return res.status(500).send('Internal Server Error');
                                    }

                                    const userWishlist = userWishlistCards.map(card => card.card_id);

                                    // Render your page with the paginated data and total pages
                                    res.render('collections/collectiondetails', {
                                        user: req.session.user,
                                        displayName: req.session.displayName,
                                        userCollection,
                                        userWishlist,
                                        cardsList: collectionCards,
                                        limit,
                                        currentSort: sort,
                                        currentPage: page,
                                        totalPages,
                                        totalRecords,
                                        collection: collection[0],
                                        collectionComments,
                                        userCollectionRating: userCollectionRating[0],
                                    });
                                })
                            })
                        })
                    } else {

                        // Render your page with the paginated data and total pages
                        res.render('collections/collectiondetails', {
                            user: req.session.user,
                            displayName: req.session.displayName,
                            userCollection,
                            userWishlist,
                            cardsList: collectionCards,
                            limit,
                            currentSort: sort,
                            currentPage: page,
                            totalPages,
                            totalRecords,
                            collection: collection[0],
                            collectionComments,
                            userCollectionRating
                        });
                    }
                });
            })
        })
    })
});

// Helper function to render my-collections page with error message
function renderMyCollectionsWithError(req, res, errorMessage) {
    const userId = req.session.user;
    const userCollectionsSQL = `SELECT * FROM collection WHERE user_id = ?`;

    connection.query(userCollectionsSQL, [userId], (err, userCollections) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Internal Server Error');
        }

        res.render('collections/my-collections', {
            user: req.session.user,
            displayName: req.session.displayName,
            collectionList: userCollections,
            errorMessage,
        });
    });
}

module.exports = router;