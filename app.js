//jshint esversion:6
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
// const encrypt = require("mongoose-encryption");
// const md5 = require("md5");
const bcrypt = require("bcrypt");
const saltRounds = 10;
const app = express();
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require("mongoose-findorcreate");

app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static("public"));
app.set("view engine","ejs");
app.use(session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB",{useNewUrlParser:true,useUnifiedTopology: true});
mongoose.set("useCreateIndex", true);

const userSchema = new mongoose.Schema({
    googleId: String,
    email: String,
    password: String,
    secret: String
});

//Level5
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

// Environment Variable
//  userSchema.plugin(encrypt,{secret: process.env.SECRET, encryptedFields:["password"]});

const User = mongoose.model("User",userSchema);

passport.use(User.createStrategy());

// use static serialize and deserialize of model for passport session support
// passport.serializeUser(User.serializeUser());
// passport.deserializeUser(User.deserializeUser());


//For all the type of strategies
passport.serializeUser(function(user, done) {
    done(null, user.id);
  });
  
  passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
      done(err, user);
    });
  });



//setting up google strategy after the session
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get("/",function(req,res){
    res.render("home");
});

app.route("/login")

.get(function(req,res){
    res.render("login");
})

.post(function(req,res){
    // User.findOne({email: req.body.username},function(err,foundUser){
    //     if(!err){
    //         if(foundUser){
    //             Using md5
    //             // if(foundUser.password === md5(req.body.password)){
    //             //     res.render("secrets");
    //             // }
    //             // Load hash from your password DB.
    //             Using bcrypt
    //             bcrypt.compare(req.body.password, foundUser.password, function(err, result) {
    //                 if(result == true){
    //                     res.render("secrets");
    //                 }
    //             });
    //         }
    //         else{
    //             console.log("No user found!");
    //         }
    //     }else{
    //         console.log(err);
    //     }
    // });

    const user = new User({
        username: req.body.username,
        password: req.body.password
    });

    req.login(user, function(err){
        if(err){
            console.log(err);
        }else{
            passport.authenticate("local")(req,res,function(){
                res.redirect("/secrets");
            });    
        }
    });
});

app.route("/register")

.get(function(req,res){
    res.render("register");
})

.post(function(req,res){

    // bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
    //     // Store hash in your password DB.
    //     const userNew = new User({
    //         email: req.body.username,
    //         password: hash
    //     });
    //     userNew.save(function(err){
    //         if(err){
    //             console.log(err);
    //         }else{
    //             res.render("secrets");
    //         }
    //     }); 
    // });

    User.register({username: req.body.username}, req.body.password, function(err,user){
        if(err){
            console.log(err);
            res.redirect("/register");
        }else{
                passport.authenticate("local")(req,res,function(){
                res.redirect("/secrets");
            });
        }
    });
});

app.get("/secrets",function(req,res){
    User.find({"secret": {$ne: null}},function(err,foundUser){
        if(err){
            console.log(err);
        }else{
            if(foundUser){
                res.render("secrets", {usersWithSecrets: foundUser});
            }
        }
    });
});

app.route("/logout")

.get(function(req,res){
    req.logout();
    res.redirect("/");
});

app.get("/auth/google",
passport.authenticate("google",{scope:["profile"]}));

app.get("/auth/google/secrets",
passport.authenticate("google",{failureRedirect: "/login" }),
function(req,res){
        res.redirect("/secrets");    
});

app.route("/submit")

.get(function(req,res){
    if(req.isAuthenticated()){
        res.render("submit");
    }else{
        res.redirect("/login");
    }
})

.post(function(req,res){
    const submittedSecret = req.body.secret;
    
    User.findById(req.user.id, function(err,foundUser){
        if(err){
            console.log(err);
        }else{
            foundUser.secret = submittedSecret;
            foundUser.save(function(){
                res.redirect("/secrets");
            });
        }
    });

});

app.listen("3000",function (){
    console.log("Server running on port 3000");    
});