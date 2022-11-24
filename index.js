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

        app.get('/role-check/:email', async (req, res)=>{
            const checkEmail = req.params.email;
            let user = await usersCollection.findOne({email : checkEmail});
            res.send({role : user?.role})
        })

        app.get('/role-set', async (req, res)=>{
            let roleTaken = req.query.role || 'buyer'
            let emailTaken = req.query.email
            let photoURLTaken = req.query.photoURL
            let displayNameTaken = req.query.displayName
            let user = await usersCollection.findOne({email: emailTaken})
            if(!user)
            {                
                let result = await usersCollection.insertOne({
                    email: emailTaken, 
                    role: roleTaken,
                    displayName : displayNameTaken,
                    photoURL : photoURLTaken
                })
                return res.send({result})
            }
            res.send({message: "already exist"})
        })

        app.get('/jwt', async (req, res)=>{
            const email = req.query.email;
            const token = jwt.sign({email}, secret)
            res.send({authToken : token})
        })

        // seller API
        app.post('/add-a-product', verify, async (req, res)=>{
            let product = req.body
            let email = req.decoded.email
            if(product.email !== email)
            return res.status(403).send({message: "Forbidden Access"}) 
            let result = await productsCollection.insertOne(product);
            res.send({result})
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