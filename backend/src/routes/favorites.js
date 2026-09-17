const express = require('express');
const { authenticate } = require('../middleware/auth');
const { listFavorites, addFavorite, removeFavorite } = require('../controllers/favoritesController');

const router = express.Router();
router.use(authenticate);
router.get('/', listFavorites);
router.post('/:instructorId', addFavorite);
router.delete('/:instructorId', removeFavorite);

module.exports = router;
