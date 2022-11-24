require("dotenv").config()
const express = require('express');
const cors = require('cors')
const app = express()
const jwt = require('jsonwebtoken')
const port = process.env.PORT || 5000
const secret = process.env.SECRET
const uri = process.env.URL

// middlewares
app.use(cors())
app.use(express.json())
const verify = (req, res, next) => {
    let authtoken = req.headers.authtoken;
    if(!authtoken)
        return res.status(401).send({message: "Unauthorised Access"})
    else{
        try{
            let decoded = jwt.verify(authtoken, secret);
            req.decoded = decoded;
            next();
        }
        catch{(err)=>{
            return res.status(403).send({message: "Forbidden Access"}) 
        }}
    }
}

// data base url
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


// API methods
async function run(){
    try{
        const usersCollection = await client.db("dpSale").collection("users")
        const productsCollection = await client.db("dpSale").collection("products")
        

        app.get('/', (req, res)=>{
            res.json("Server is runnning perfectly")
        })

        
    }
    finally{

    }
}

run().catch(err=>console.log(err))

// listener
app.listen(port, ()=> {
    client.connect(err => {
        if(err)
            console.log(err);
        else
            console.log('Database Connected Successfully');
    });
    console.log(`Server running at ${port}`);
})