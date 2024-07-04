const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const dbURI = 'mongodb+srv://prachii0223:T06BE3dx92UIsFth@cluster0.5ny1ww4.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(dbURI, { 
  useNewUrlParser: true, 
  useUnifiedTopology: true,
  ssl: true,
  tlsAllowInvalidCertificates: true, // Use only for development
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

mongoose.connection.on('connected', () => {
  console.log('Mongoose connected to DB');
});
mongoose.connection.on('error', err => {
  console.error('Mongoose connection error:', err);
});
mongoose.connection.on('disconnected', () => {
  console.log('Mongoose disconnected');
});

const LoginSchema = new mongoose.Schema({
  loginTime: { type: Date, default: Date.now },
  logoutTime: Date,
});

const UserSchema = new mongoose.Schema({
  name: String,
  phone: String,
  email: String,
  username: String,
  password: String,
  userType: { type: String, enum: ['admin', 'user'], default: 'user' },
  logins: [LoginSchema],
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Book' }],
});

const User = mongoose.model('User', UserSchema);

const BookSchema = new mongoose.Schema({
  title: String,
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'Author' },
  publisher: { type: mongoose.Schema.Types.ObjectId, ref: 'Publisher' },
  publishedDate: Date,
  copies: Number,
  imageUrl: String,
  price: Number,
  summary: String,
});


const PublisherSchema = new mongoose.Schema({
  name: String,
  authors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Author' }],
});

const AuthorSchema = new mongoose.Schema({
  name: String,
  books: [BookSchema],
});

const Publisher = mongoose.model('Publisher', PublisherSchema);
const Author = mongoose.model('Author', AuthorSchema);
const Book = mongoose.model('Book', BookSchema);

app.post('/register', async (req, res) => {
  try {
    const { name, phone, email, username, password } = req.body;
    let userType = 'user';
    if (email.endsWith('@numetry.com')) {
      userType = 'admin';
    }
    const user = new User({ name, phone, email, username, password, userType });
    await user.save();
    res.status(201).send({ message: 'User registered successfully' });
  } catch (err) {
    console.error('Error registering user:', err);
    res.status(500).send({ message: 'Error registering user' });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password });
    if (user) {
      const currentLogin = { loginTime: new Date() };
      user.logins.push(currentLogin);
      await user.save();
      const message = user.userType === 'admin' ? 'Welcome to the admin dashboard' : 'Welcome to the user dashboard';
      res.send({ message });
    } else {
      res.status(401).send({ message: 'Invalid email or password' });
    }
  } catch (err) {
    console.error('Error logging in user:', err);
    res.status(500).send({ message: 'Error logging in user' });
  }
});

app.post('/logout', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (user && user.logins.length > 0) {
      const lastLogin = user.logins[user.logins.length - 1];
      lastLogin.logoutTime = new Date();
      await user.save();
      res.send({ message: 'Logout successful' });
    } else {
      res.status(404).send({ message: 'User not found or no login session found' });
    }
  } catch (err) {
    console.error('Error logging out user:', err);
    res.status(500).send({ message: 'Error logging out user' });
  }
});

app.get('/users', async (req, res) => {
  try {
    const users = await User.find({ userType: 'user' });
    res.send(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).send({ message: 'Error fetching users' });
  }
});

app.post('/update-user', async (req, res) => {
  try {
    const { id, name, email, loginTime } = req.body;
    const user = await User.findByIdAndUpdate(id, {
      name,
      email,
      $push: { logins: { loginTime } }
    }, { new: true });
    if (user) {
      res.send({ message: 'User updated successfully', user });
    } else {
      res.status(404).send({ message: 'User not found' });
    }
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).send({ message: 'Error updating user' });
  }
});

app.post('/delete-user', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOneAndDelete({ email });
    if (user) {
      res.send({ message: 'User deleted successfully' });
    } else {
      res.status(404).send({ message: 'User not found' });
    }
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).send({ message: 'Error deleting user' });
  }
});

app.post('/add-book', async (req, res) => {
  try {
    const { title, author, publisher, publishedDate, copies, imageUrl, price, summary } = req.body;

    // Find or create the publisher
    let pub = await Publisher.findOne({ name: publisher });
    if (!pub) {
      pub = new Publisher({ name: publisher });
      await pub.save();
    }

    // Find or create the author
    let auth = await Author.findOne({ name: author });
    if (!auth) {
      auth = new Author({ name: author });
      await auth.save();
    }

    // Create the book
    const book = new Book({ title, author: auth._id, publisher: pub._id, publishedDate, copies, imageUrl, price, summary });
    await book.save();
// decrease number of copies
app.post('/buy-book', async (req, res) => {
  const { email, bookId } = req.body;

  try {
    const user = await User.findOne({ email });
    const book = await Book.findById(bookId);

    if (!user || !book) {
      return res.status(404).json({ success: false, message: 'User or book not found' });
    }

    if (book.copies <= 0) {
      return res.status(400).json({ success: false, message: 'No copies left to buy' });
    }

    // Decrement the number of copies by 1
    book.copies -= 1;
    await book.save();

    return res.status(200).json({ success: true, message: 'Book bought successfully' });
  } catch (error) {
    console.error('Error buying book:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

    // Update publisher and author with the new book
    pub.authors.push(auth._id);
    await pub.save();
    auth.books.push(book._id);
    await auth.save();

    res.status(201).send({ message: 'Book added successfully', book });
  } catch (err) {
    console.error('Error adding book:', err);
    res.status(500).send({ message: 'Error adding book' });
  }
});

app.get('/books', async (req, res) => {
  try {
    const books = await Book.find().populate('author publisher');
    res.send(books);
  } catch (err) {
    console.error('Error fetching books:', err);
    res.status(500).send({ message: 'Error fetching books' });
  }
});

app.post('/add-to-wishlist', async (req, res) => {
  try {
    const { email, bookId } = req.body;
    const user = await User.findOne({ email });
    if (user) {
      const book = await Book.findById(bookId);
      if (book) {
        if (!user.wishlist.includes(book._id)) {
          user.wishlist.push(book._id);
          await user.save();
          res.status(200).send({ message: 'Book added to wishlist' });
        } else {
          res.status(400).send({ message: 'Book already in wishlist' });
        }
      } else {
        res.status(404).send({ message: 'Book not found' });
      }
    } else {
      res.status(404).send({ message: 'User not found' });
    }
  } catch (err) {
    console.error('Error adding book to wishlist:', err);
    res.status(500).send({ message: 'Error adding book to wishlist' });
  }
});

app.get('/wishlist', async (req, res) => {
  try {
    const { email } = req.query;
    const user = await User.findOne({ email }).populate({
      path: 'wishlist',
      populate: { path: 'author', model: 'Author' }
    });
    if (user) {
      res.status(200).send(user.wishlist);
    } else {
      res.status(404).send({ message: 'User not found' });
    }
  } catch (err) {
    console.error('Error fetching wishlist:', err);
    res.status(500).send({ message: 'Error fetching wishlist' });
  }
});

app.post('/remove-from-wishlist', async (req, res) => {
  try {
    const { email, bookId } = req.body;
    const user = await User.findOne({ email });
    if (user) {
      // Remove bookId from wishlist array
      user.wishlist = user.wishlist.filter(wishlistBook => wishlistBook.toString() !== bookId);
      await user.save();
      res.status(200).send({ message: 'Book removed from wishlist' });
    } else {
      res.status(404).send({ message: 'User not found' });
    }
  } catch (err) {
    console.error('Error removing book from wishlist:', err);
    res.status(500).send({ message: 'Error removing book from wishlist' });
  }
});


// server.js

// ... existing code ...

app.post('/buy-book', async (req, res) => {
  const { email, bookId } = req.body;

  try {
    const user = await User.findOne({ email });
    const book = await Book.findById(bookId);

    if (!user || !book) {
      return res.status(404).json({ success: false, message: 'User or book not found' });
    }

    if (book.copies <= 0) {
      return res.status(400).json({ success: false, message: 'No copies left to buy' });
    }

    // Decrement the number of copies by 1
    book.copies -= 1;
    await book.save();

    return res.status(200).json({ success: true, message: 'Book bought successfully' });
  } catch (error) {
    console.error('Error buying book:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.get('/books', async (req, res) => {
  try {
    const books = await Book.find().populate('author publisher');
    res.send(books);
  } catch (err) {
    console.error('Error fetching books:', err);
    res.status(500).send({ message: 'Error fetching books' });
  }
});

//search 
// Example server-side code in Node.js/Express
app.get('/books', async (req, res) => {
  const { search } = req.query;
  const query = {};

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { 'author.name': { $regex: search, $options: 'i' } },
      { 'publisher.name': { $regex: search, $options: 'i' } }
    ];
  }

  try {
    const books = await Book.find(query).populate('author publisher');
    console.log('Books found:', books); // Debug log
    res.json(books);
  } catch (error) {
    console.error('Error fetching books:', error);
    res.status(500).send('Server error');
  }
});

//serach


const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
