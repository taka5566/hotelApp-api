const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./models/User.js');
const Place = require('./models/Place.js');
const Booking = require('./models/Booking.js');
require('dotenv').config();
const app = express();
const cookieParser = require('cookie-parser');
const imageDownloader = require('image-downloader');
const multer = require('multer');
const fs = require('fs');

const bcryptSalt = bcrypt.genSaltSync(10);
const jwtSecret = process.env.JWT_SECRET;

app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(__dirname + '/uploads'));
app.use(cors({
    credentials: true,
    origin: 'https://hotelapp-5zvs.onrender.com',
    methods:["POST","GET"]
}));

mongoose.connect(process.env.MONGO_URL);

function getUserDataFromReq(req) {
  return new Promise((resolve, reject) => {
    jwt.verify(req.cookies.token, jwtSecret, {}, (err, userData) => {
      if (err) {
        reject(new Error('Invalid token'));
      } else {
        resolve(userData);
      }
    });
  });
}

app.get("/", (req, res) => {

  res.json('123132');
});

app.get("/test", (req, res) => {

  res.json('test123');
});
// username:booking
// bdpw:jvlx8MVobRBLgc3h

app.post('/register', async (req,res) => {
  const {name,email,password} = req.body;

  try{

    const userDoc = await User.create({
    name,
    email,
    password:bcrypt.hashSync(password, bcryptSalt),
  });
  res.json(userDoc);

  } catch (e) {
    res.status(422).json(e);
  }


});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const userDoc = await User.findOne({ email });
  if (userDoc) {
    const passOk = bcrypt.compareSync(password, userDoc.password);
    if (passOk) {
      const token = jwt.sign({ userId: userDoc._id }, process.env.JWT_SECRET, {
        expiresIn: '15d'
      });

      res.cookie('jwt', token, {
        maxAge: 15 * 24 * 60 * 60 * 1000, // MS
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV !== 'development'
      });

      res.json(userDoc);
    } else {
      res.status(422).json('pw not ok');
    }
  } else {
    res.json('not found');
  }
});

app.get('/profile', (req,res) =>{
  const {token} = req.cookies;
  if (token) {
    jwt.verify(token, jwtSecret, {}, async (err, userData)=> {
      if (err) throw err;
      const {name,email,_id} = await User.findById(userData.id);
      res.json({name,email,_id});

    });

  }else {
    res.json(null);
  }


});

app.post('/logout', (req,res) => {
  res.cookie('token','').json(true);
});

app.post('/upload-by-link', async (req,res) => {
  const {link} = req.body;
  const newName = 'photo' + Date.now() + '.jpg';
  await  imageDownloader.image({
    url: link,
    dest:__dirname + '/uploads/' + newName,
  });
  res.json(newName);

});

const photosMiddleware = multer({dest:'uploads/'});
app.post('/upload',photosMiddleware.array('photos', 100), (req,res) =>{
const uploadedFiles = [];
for (let i = 0; i < req.files.length; i++) {
  const { path, originalname } = req.files[i];
  const parts = originalname.split('.');
  const ext = parts[parts.length - 1];
  const newPath = path + '.' + ext;

  fs.renameSync(path, newPath);

  const normalizedPath = newPath.replace(/\\/g, '/');
  const relativePath = normalizedPath.replace('uploads/', '');
  uploadedFiles.push(relativePath);
}

res.json(uploadedFiles);
});

app.post('/places', (req,res) => {
  const {token} = req.cookies;
  const {title, address, addedPhotos, description,
  perks,extraInfo,checkIn,checkOut,maxGuests,price,
  } = req.body;
  jwt.verify(token, jwtSecret, {}, async (err, userData)=> {
      if (err) throw err;
      const placeDoc = await Place.create({
         owner:userData.id,
         title, address, photos:addedPhotos, description,
         perks,extraInfo,checkIn,checkOut,maxGuests,price,
  });
  res.json(placeDoc);
    });


});

app.get('/user-places', (req,res) => {
  const {token} = req.cookies;
  jwt.verify(token, jwtSecret, {}, async (err, userData)=> {
  const {id} = userData;
  res.json( await Place.find({owner:id}) );
});
});

app.get('/places/:id', async (req,res) => {
  const {id} = req.params;
  res.json(await Place.findById(id));
});

app.put('/places', async (req,res) => {
  const {token} = req.cookies;
  const {id, title, address, addedPhotos, description,
  perks,extraInfo,checkIn,checkOut,maxGuests,price,
  } = req.body;

  jwt.verify(token, jwtSecret, {}, async (err, userData)=> {
    if (err) throw err;

    const placeDoc = await Place.findById(id);
    if (userData.id === placeDoc.owner.toString()) {
      placeDoc.set({        
         title, address, photos:addedPhotos, description,
         perks,extraInfo,checkIn,checkOut,maxGuests,price,  
      });
      await placeDoc.save();
      res.json('ok');
    }
    
  });

})

app.get('/places', async (req,res) => {
  res.json( await Place.find());
});

app.post('/bookings', async (req, res) => {
  const userData = await getUserDataFromReq(req);
  const {
    place, checkIn, checkOut, numberOfGuests, name, phone, price
  } = req.body;

  Booking.create({
    place, checkIn, checkOut, numberOfGuests, name, phone, price,
    user:userData.id,
  })
    .then((doc) => {
      res.json(doc);
    })
    .catch((err) => {
      throw err;
    });
});



app.get('/bookings', async (req,res) => {
    const userData = await getUserDataFromReq(req);
    res.json( await Booking.find({user:userData.id}).populate('place'))
})

const port = process.env.PORT || 4000; 

app.listen(port, () => {
  console.log(`Server is listening on this port ${port} !`);
});


