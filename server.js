// server.js - Backend de StockApp Melchisédech

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); 
const path = require('path'); // Nécessaire pour servir les fichiers statiques

const app = express();

// --- Configuration d'Environnement (Crucial pour Render) ---
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI; 

if (!MONGO_URI) {
    console.error("ERREUR: La variable d'environnement MONGO_URI n'est pas définie.");
}

// --- Middlewares ---
app.use(cors()); 
app.use(express.json()); 

// --- Connexion à MongoDB Atlas ---
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB Atlas connecté avec succès.'))
    .catch(err => console.error('❌ Erreur de connexion MongoDB Atlas :', err.message));

// ------------------------------------
// 1. Définition des Modèles de Données
// ------------------------------------

// Modèle Produit
const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    quantity: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0.01 }, 
    minStockLevel: { type: Number, required: true, min: 0 },
}, { timestamps: true });

const Product = mongoose.model('Product', ProductSchema);

// Modèle Vente
const SaleSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    unitPrice: { type: Number, required: true, min: 0.01 }, 
    quantitySold: { type: Number, required: true, min: 1 },
    totalPrice: { type: Number, required: true },
    saleDate: { type: Date, default: Date.now }
});

const Sale = mongoose.model('Sale', SaleSchema);

// NOUVEAU: Modèle Achat (Entrée de Stock)
const PurchaseSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    unitPrice: { type: Number, required: true, min: 0.01 }, // Prix d'achat unitaire
    quantityPurchased: { type: Number, required: true, min: 1 },
    totalPrice: { type: Number, required: true },
    purchaseDate: { type: Date, default: Date.now }
});

const Purchase = mongoose.model('Purchase', PurchaseSchema);


// ------------------------------------
// 2. Routes de l'API (Endpoints REST)
// ------------------------------------

const API_BASE_URL = '/api';

// --- A. Produits (/api/products) ---

// GET: Récupérer tous
app.get(`${API_BASE_URL}/products`, async (req, res) => {
    try {
        const products = await Product.find().sort({ name: 1 });
        res.json(products);
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des produits.' });
    }
});

// POST: Créer un produit
app.post(`${API_BASE_URL}/products`, async (req, res) => {
    try {
        const newProduct = new Product(req.body);
        const savedProduct = await newProduct.save();
        res.status(201).json(savedProduct);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ message: "Un produit avec ce nom existe déjà." });
        }
        res.status(400).json({ message: "Données de produit invalides: " + err.message });
    }
});

// PUT: Mettre à jour un produit
app.put(`${API_BASE_URL}/products/:id`, async (req, res) => {
    try {
        const updatedProduct = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!updatedProduct) {
            return res.status(404).json({ message: "Produit non trouvé." });
        }
        res.json(updatedProduct);
    } catch (err) {
        if (err.code === 11000) {
             return res.status(409).json({ message: "Ce nom de produit est déjà utilisé." });
        }
        res.status(400).json({ message: "Erreur de mise à jour: " + err.message });
    }
});

// DELETE: Supprimer un produit
app.delete(`${API_BASE_URL}/products/:id`, async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);
        if (!product) {
            return res.status(404).json({ message: "Produit non trouvé." });
        }
        res.status(204).send(); 
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur lors de la suppression.' });
    }
});

// --- B. Ventes (/api/sales) ---

// GET: Récupérer toutes les ventes (Rapport)
app.get(`${API_BASE_URL}/sales`, async (req, res) => {
    try {
        const sales = await Sale.find().sort({ saleDate: -1 }); 
        res.json(sales);
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des ventes.' });
    }
});

// POST: Enregistrer une nouvelle vente (décrémente le stock)
app.post(`${API_BASE_URL}/sales`, async (req, res) => {
    const { productId, quantitySold, unitPrice } = req.body;

    try {
        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({ message: "Produit non trouvé dans l'inventaire." });
        }
        if (product.quantity < quantitySold) {
            return res.status(400).json({ message: `Stock insuffisant pour ${product.name}. Stock actuel: ${product.quantity}.` });
        }
        
        // 1. Création de l'objet Vente
        const newSale = new Sale({
            productId: product._id,
            productName: product.name,
            unitPrice: unitPrice,
            quantitySold: quantitySold,
            totalPrice: unitPrice * quantitySold
        });
        await newSale.save();

        // 2. Mise à jour du Stock
        product.quantity -= quantitySold;
        await product.save();

        res.status(201).json(newSale); 
    } catch (err) {
        res.status(500).json({ message: "Erreur lors de l'enregistrement de la vente: " + err.message });
    }
});

// --- C. Achats (/api/purchases) ---

// GET: Récupérer tous les achats (Rapport)
app.get(`${API_BASE_URL}/purchases`, async (req, res) => {
    try {
        const purchases = await Purchase.find().sort({ purchaseDate: -1 }); 
        res.json(purchases);
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des achats.' });
    }
});

// POST: Enregistrer un nouvel achat (incrémente le stock)
app.post(`${API_BASE_URL}/purchases`, async (req, res) => {
    const { productId, quantityPurchased, unitPrice } = req.body;

    try {
        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({ message: "Produit non trouvé dans l'inventaire." });
        }
        
        // 1. Création de l'objet Achat
        const newPurchase = new Purchase({
            productId: product._id,
            productName: product.name,
            unitPrice: unitPrice,
            quantityPurchased: quantityPurchased,
            totalPrice: unitPrice * quantityPurchased
        });
        await newPurchase.save();

        // 2. Mise à jour du Stock (ajout)
        product.quantity += quantityPurchased;
        await product.save();

        res.status(201).json(newPurchase); 
    } catch (err) {
        res.status(500).json({ message: "Erreur lors de l'enregistrement de l'achat: " + err.message });
    }
});


// ------------------------------------
// 3. Configuration du Frontend et Démarrage
// ------------------------------------

// 1. Servir les fichiers statiques (index.html, script.js, styles.css, etc.)
app.use(express.static(path.join(__dirname)));

// 2. Route par défaut : envoyer index.html pour toute requête non-API (y compris la route '/')
app.get('/*', (req, res) => {
    // Si la requête commence par /api, on la laisse aux routes API
    if (req.url.startsWith('/api')) {
        return; 
    }
    // Envoie le fichier d'interface utilisateur
    res.sendFile(path.join(__dirname, 'index.html'));
});


// Démarrage du Serveur
app.listen(PORT, () => {
    console.log(`🚀 Serveur StockApp Melchisédech démarré. Écoute sur le port ${PORT}`);
});
