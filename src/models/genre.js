const mongoose = require('mongoose')

const schema = new mongoose.Schema({
  genre: {
    type: String,
    required: true,
    unique: true,
    minlength: 3
  }
})

module.exports = mongoose.model('Genre', schema)