const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
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
        const paymentCollection = client.db("bistroBossDB").collection("payments");

        // ----------JWT token api----------------
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET,
                { expiresIn: '1h' })
            res.send({ token });
        })

        
        //---------- middleware-------------
        // verify token 
        const verifyToken = (req, res, next) => {
            if (!req.headers.authorization) {
                return res.status(401).send({
                    message: 'Unauthorized access'
                })
            }
            const token = req.headers?.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({
                        message: 'Unauthorized access'
                    })
                }
                req.decoded = decoded
                next()
            });
        }
        // verify admin token
        const adminToken = async (req, res, next) => {
            const email = req.decoded.email;
            const query = {
                email: email
            };
            const user = await userCollection.findOne(query);
            // console.log(user);
            const isAdmin = user.role === 'Admin';
            if (!isAdmin) {
                return res.status(403).send({
                    message: 'forbidden access'
                })
            }
            next()
        }


        //---------- user collection here----------
        app.get('/api/user', verifyToken, adminToken, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        })

        app.get('/api/user/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({message: 'Forbidden access'})
            }
            const query = { email: email };
            const user = await userCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role === 'Admin'
            }
            res.send({admin})
        })

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
        
        app.patch('/api/user/admin/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set:{
                    role: 'Admin'
                }   
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        app.delete('/api/user/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await userCollection.deleteOne(query);
            res.send(result);
        })

        // -------------menu collection here ---------
        app.get('/api/menu', async (req, res) => {
            const result = await menuCollection.find().toArray();
            res.send(result);
        })
        
        app.get('/api/menu/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await menuCollection.findOne(query);
            res.send(result);
        })
        
        app.post('/api/menu', verifyToken, adminToken, async (req, res) => {
            const item = req.body;
            const result = await menuCollection.insertOne(item);
            res.send(result);
        })

        app.patch('/api/menu/:id', async (req, res) => {
            const item = req.body;
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    name: item.name,
                    category: item.category,
                    price: item.price,
                    recipe: item.recipe,
                    image: item.image
                },
            }
            const result = await menuCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        app.delete('/api/menu/:id', verifyToken, adminToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await menuCollection.deleteOne(query);
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

        app.delete('/api/carts/:id', verifyToken, adminToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cartsCollection.deleteOne(query);
            res.send(result);
        })

        //----------------- payment intent---------------
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 1000)

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types:['card']
            })
            res.send({
                clientSecret: paymentIntent.client_secret,
            })
        })

        app.post('/api/payment', async (req, res) => {
            const payment = req.body;
            const paymentResult = await paymentCollection.insertOne(payment);

            const query = {
                _id: {
                    $in: payment.cartIds.map(id => new ObjectId(id))
                }
            }
            const deletedResult = await cartsCollection.deleteMany(query);
            res.send({
                paymentResult,
                deletedResult
            })
        })

        app.get('/api/payment/:email', verifyToken, async (req, res) => {
            const query = {
                email: req.params.email
            };
            if (req.params.email !== req.decoded.email) {
                return res.status(403).send('forbidden access');
            }
            const result = await paymentCollection.find(query).toArray();
            res.send(result);
        })

        // ----------admin stats-------------
        app.get('/admin/stats', verifyToken, adminToken, async (req, res) => {
            const users = await userCollection.estimatedDocumentCount();
            const menuItem = await menuCollection.estimatedDocumentCount();
            const paymentOrder = await paymentCollection.estimatedDocumentCount();

            const result = await paymentCollection.aggregate([
                {
                    $group: {
                        _id: null,
                        totalRevenue: {
                            $sum: '$price',
                        }
                    }
                }
            ]).toArray();

            const revenue = result.length > 0 ? result[0].totalRevenue : 0;

            res.send({
                users,
                menuItem,
                paymentOrder,
                revenue
            })
        })

        // using aggregate pipeline
        app.get('/order/stats', verifyToken, adminToken, async (req, res) => {
            const result = await paymentCollection.aggregate([
                {
                    $unwind: "$menuIds"
                },
                {
                    $lookup:{
                        from: 'menu',
                        localField: 'menuIds',
                        foreignField: '_id',
                        as:'menuItems'
                    }
                },
                {
                    $unwind: '$menuIds'
                },
                {
                    $group: {
                        _id: "$menuItems.category",
                        quantity: {$sum:1},
                        revenue: {
                            $sum: '$menuItems.price'
                        }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        category: '$_id',
                        quantity: '$quantity',
                        revenue: '$revenue'
                    }
                }
            ]).toArray();

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