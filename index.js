const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config()
const port = process.env.PORT || 5000
const { MongoClient, ServerApiVersion, ObjectId} = require('mongodb');


// middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hv389kw.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {

        // database collection
        const userCollection = client.db("bistroBossDB").collection("users");
        const menuCollection = client.db("bistroBossDB").collection("menu");
        const reviewsCollection = client.db("bistroBossDB").collection("reviews");
        const cartsCollection = client.db("bistroBossDB").collection("carts");

        //---------- user collection here----------
        app.post('/api/user', async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exists', insertedId: null})
            }
            const result = await userCollection.insertOne(user);
            res.send(result)
        })

        // -------------menu collection here ---------
        app.get('/api/menu', async (req, res) => {
            const result = await menuCollection.find().toArray();
            res.send(result);
        })

        // --------reviewsCollection here--------------
        app.get('/api/reviews', async (req, res) => {
            const result = await reviewsCollection.find().toArray();
            res.send(result);
        })
        // --------------cartsCollection--------
        app.get('/api/carts', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const cartData = await cartsCollection.find(query).toArray();
            res.send(cartData);
        })

        app.post('/api/carts', async (req, res) => {
            const cartItem = req.body;
            const result = await cartsCollection.insertOne(cartItem);
            res.send(result);
        })

        app.delete('/api/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cartsCollection.deleteOne(query);
            res.send(result);
        })



        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
    }
}
run().catch(console.dir);



app.get('/', (req, res)=>{
    res.send('Bistro boss is running...')
})

app.listen(port, () => {
    console.log(`Bistro boss server on port ${port}`);
})