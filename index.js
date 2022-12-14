require("dotenv").config()
const express = require('express');
const stripe = require("stripe")(process.env.STRIPE_SECRET)
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
        const categoriesCollection = await client.db("dpSale").collection("categories")
        const bookedCollection = await client.db("dpSale").collection("booked")
        const paidCollection = await client.db("dpSale").collection("paid")
        

        app.get('/', (req, res)=>{
            res.json("Server is runnning perfectly")
        })

        app.get('/role-check/:email', async (req, res)=>{
            const checkEmail = req.params.email;
            let user = await usersCollection.findOne({email : checkEmail});
            let result = {
                role : user?.role,
                banned : user?.banned
            }

            res.send(result)
        })

        app.get('/verified-check/:email', async (req, res)=>{
            const checkEmail = req.params.email;
            let user = await usersCollection.findOne({email : checkEmail});
            res.send({verified : user?.verified})
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
       

        app.get('/advertise-products', async (req, res)=>{
            let products = await productsCollection.find({advertise : true}).toArray()
            let result = []
            products.forEach(p => {
                if(p.status !== 'sold')
                    result.push(p)
            })
            res.send({result})
        })

        app.get('/category', async (req, res)=>{
            let result = await categoriesCollection.find({}).toArray()
            res.send({result})
        })

        app.get('/category/:title', async (req, res)=>{
            let title = req.params.title
            let products = await productsCollection.find({category: title}).toArray()
            let result = []
            products.forEach(p => {
                if(p.status !== 'sold')
                    result.push(p)
            })
            // let result = await productsCollection.find({}).toArray()
            res.send({result})
        })



        // seller API
        app.post('/add-a-product', verify, async (req, res)=>{
            let product = req.body
            let email = req.decoded.email
            let user = await usersCollection.findOne({email: email})
            if(product.sellerEmail !== email || user.role !== 'seller')
                return res.status(403).send({message: "Forbidden Access"}) 
             
            let result = await productsCollection.insertOne(product);
            res.send({result})
        })
        app.get('/my-buyers', verify, async (req, res)=>{
            let email = req.decoded.email
            if(req.query.email !== email)
            return res.status(403).send({message: "Forbidden Access"}) 

            let booked = await bookedCollection.find({sellerEmail: email}).toArray();
            let allBuyers = await usersCollection.find({role : 'buyer'}).toArray();

            let result = []
            allBuyers.forEach(a => {
                booked.forEach(b => {
                    if(a.email === b.buyerEmail)
                    {
                        if(result.indexOf(a)>=0)
                            return;
                        result.push(a);
                    }
                })
            })
            res.send({result})
        })

        app.get('/my-products', verify, async (req, res)=>{
            let email = req.decoded.email
            if(req.query.email !== email)
            return res.status(403).send({message: "Forbidden Access"}) 
            
            let result = await productsCollection.find({sellerEmail: email}).toArray();
            res.send({result})
        })

        app.delete('/my-products', verify, async (req, res)=>{
            let email = req.decoded.email
            if(req.query.email !== email)
            return res.status(403).send({message: "Forbidden Access"}) 
            let id = req.query.id;
            let query = {_id : ObjectId(id)}
            let result = await productsCollection.deleteOne(query);
            res.send({result})
        })

        app.put('/my-products', verify, async (req, res)=>{
            let email = req.decoded.email
            if(req.query.email !== email)
            return res.status(403).send({message: "Forbidden Access"}) 

            let id = req.query.id;
            let query = {_id : ObjectId(id)}
            let updateDoc = {
                $set : {
                    advertise : true
                }
            }
            let result = await productsCollection.updateOne(query, updateDoc);
            res.send({result})
        })

        // admin API
        app.get('/all-sellers', verify, async (req, res) => {
            let email = req.decoded.email;
            let user = await usersCollection.findOne({email: email})
            if(email !== req.query.email || user?.role !== 'admin')
            return res.status(403).send({message: "Forbidden Access"}) 
            let result =[]
            let allSeller = await usersCollection.find({role : 'seller'}).toArray()
            allSeller.forEach(a => {
                if(!a.banned)
                    result.push(a)
            })

            res.send({result})
        })
        // app.delete('/all-sellers', verify, async (req, res) => {
        //     let email = req.decoded.email;
        //     let user = await usersCollection.findOne({email: email})
        //     if(email !== req.query.email || user?.role !== 'admin')
        //     return res.status(403).send({message: "Forbidden Access"}) 
        //     let id = req.query.id
        //     let query = {_id : ObjectId(id)}
        //     let result = await usersCollection.deleteOne(query)
        //     res.send({result})
        // })
        app.put('/all-sellers', verify, async (req, res) => {
            let email = req.decoded.email;
            let user = await usersCollection.findOne({email: email})
            if(email !== req.query.email || user?.role !== 'admin')
            return res.status(403).send({message: "Forbidden Access"}) 
            let id = req.query.id
            let task = req.query.task
            let query = {_id : ObjectId(id)}
            let updateDoc ={} ;
            if(task === 'verify'){
                updateDoc = {
                    $set : {verified : true}
                }
            } else if(task === 'ban'){
                updateDoc = {
                    $set : {banned : true}
                }
            }
            let result = await usersCollection.updateOne(query, updateDoc, {upsert : true})
            res.send({result})
        })

        app.get('/all-buyers', verify, async (req, res) => {
            let email = req.decoded.email;
            let user = await usersCollection.findOne({email: email})
            if(email !== req.query.email || user?.role !== 'admin')
            return res.status(403).send({message: "Forbidden Access"}) 

            let result =[]
            let allBuyer = await usersCollection.find({role : 'buyer'}).toArray()
            allBuyer.forEach(a => {
                if(!a.banned)
                    result.push(a)
            })
            res.send({result})
        })
        app.put('/all-buyers', verify, async (req, res) => {
            let email = req.decoded.email;
            let user = await usersCollection.findOne({email: email})
            if(email !== req.query.email || user?.role !== 'admin')
            return res.status(403).send({message: "Forbidden Access"}) 
            let id = req.query.id
            let query = {_id : ObjectId(id)}
            let updateDoc = {
                $set : {
                    banned : true
                }
            }
            let result = await usersCollection.updateOne(query, updateDoc, {upsert : true})
            res.send({result})
        })


        app.get('/reported-items', verify, async (req, res) => {
            let email = req.decoded.email;
            let user = await usersCollection.findOne({email: email})
            if(email !== req.query.email || user?.role !== 'admin')
            return res.status(403).send({message: "Forbidden Access"}) 
            let result = await productsCollection.find({reported: true}).toArray()
            res.send({result})
        })

        app.delete('/reported-items', verify, async (req, res) => {
            let email = req.decoded.email;
            let user = await usersCollection.findOne({email: email})
            if(email !== req.query.email || user?.role !== 'admin')
            return res.status(403).send({message: "Forbidden Access"}) 
            let id = req.query.id
            let query = {_id : ObjectId(id)}
            let result = await productsCollection.deleteOne(query)
            res.send({result})
        })

        
        // buyer API
        app.put('/report-a-item', verify, async (req, res)=>{
            let email = req.decoded.email;
            if(req.query.email !== email)
            return res.status(403).send({message: "Forbidden Access"}) 
            let user = await usersCollection.findOne({email : email})
            let id = req.query.id;
            let query = {_id : ObjectId(id)}
            let result = {}
            if(user.role === 'buyer'){
                let updateDoc = {
                    $set : {
                        reported : true
                    }
                }
                result = await productsCollection.updateOne(query, updateDoc, {upsert : true})
            }
            else{
                result = {
                    acknowledged : false
                }
            }
            res.send({result})
        })

        app.post('/book-a-item', verify, async (req, res)=>{
            let email = req.decoded.email;
            if(req.query.email !== email)
            return res.status(403).send({message: "Forbidden Access"}) 
            let product = req.body;
            let already = await bookedCollection.findOne({product_ID : product.product_ID, buyerEmail : product.buyerEmail})
            
            let updateDoc = {
                $set : {
                    status : 'booked'
                }
            }
            await productsCollection.updateOne({_id : ObjectId(product.product_ID)}, updateDoc, {upsert : true});

            let result = {
                acknowledged : true,
                previous : true
            };
            if(!already)
                result = await bookedCollection.insertOne(product)
            res.send({result})
        })
        app.get('/my-booked-items', verify, async (req, res)=>{
            let email = req.decoded.email;
            if(req.query.email !== email)
            return res.status(403).send({message: "Forbidden Access"}) 
            let bookedProducts = await bookedCollection.find({buyerEmail : email}).toArray()
            let allProducts = await productsCollection.find({}).toArray()
            let products = []
            bookedProducts.forEach( b => {
                allProducts.forEach( a => {
                    let id = (a._id.toString())
                    if(b.product_ID === id)
                        products.push(a)
                })
            })
            res.send({products})
        })

        app.get('/single-product', verify, async (req, res)=>{
            let email = req.decoded.email;
            if(req.query.email !== email)
            return res.status(403).send({message: "Forbidden Access"})
            let id = req.query.id
            let booked = await bookedCollection.findOne({product_ID : id, buyerEmail : email})
            let product = await productsCollection.findOne({_id : ObjectId(id)})
            product = {product, booked}
            res.send({product})
        })
        app.delete('/my-booked-items', verify, async (req, res)=>{
            let email = req.decoded.email;
            if(req.query.email !== email)
            return res.status(403).send({message: "Forbidden Access"}) 
            
            let query = { 
                buyerEmail : email,
                product_ID : req.query.id
            }
            let updateDoc = {
                $set : {
                    status : 'available'
                }
            }
            await productsCollection.updateOne({_id : ObjectId(req.query.id)}, updateDoc, {upsert : true});

            let result = await bookedCollection.deleteOne(query)
            
            res.send({result})
        })

        app.post('/create-payment-intent', verify, async(req, res)=> {
            let email = req.decoded.email;
            if(req.query.email !== email)
            return res.status(403).send({message: "Forbidden Access"})
            let price = parseInt(req.body.price) * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: price,
                currency: "usd",
                "payment_method_types": [
                    "card"
                  ],
              });
            res.send(paymentIntent)
        })
        app.post('/payment-complete', verify, async(req, res)=> {
            let email = req.decoded.email;
            if(req.query.email !== email)
            return res.status(403).send({message: "Forbidden Access"})

            let paymentIntent = req.body.paymentIntent
            let product_ID = req.body.product_ID
            let result = await paidCollection.insertOne({paymentIntent : paymentIntent, product_ID : product_ID, buyerEmail : email})
            let updateDoc1 = {
                $set : {
                    status : 'sold',
                }
            }
            let updateDoc2 = {
                $set : {
                    paid : true
                }
            }
            
            let result2 = await productsCollection.updateOne({_id: ObjectId(product_ID)}, updateDoc1, { upsert : true } )
            let result3 = await bookedCollection.updateOne({product_ID: product_ID,buyerEmail : email}, updateDoc2, { upsert : true } )
            let result4 = await bookedCollection.deleteMany({product_ID: product_ID, paid : false})
            res.send({result, result2, result3, result4})
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