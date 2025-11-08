// server.js - Backend de StockApp Melchisédech

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); 

const app = express();

// --- Configuration d'Environnement (Crucial pour Render) ---

// Le PORT est défini par l'hébergeur (Render) via process.env.PORT, ou 3000 en local.
const PORT = process.env.PORT || 3000;

// L'URI de connexion complète de MongoDB Atlas sera lue depuis la variable
// d'environnement que nous allons configurer sur Render.
const MONGO_URI = process.env.MONGO_URI; 

// Si l'URI n'est pas définie (par exemple, en local sans fichier .env), on sort avec une erreur.
if (!MONGO_URI) {
    console.error("ERREUR: La variable d'environnement MONGO_URI n'est pas définie.");
    // Vous pouvez remplacer cela par votre URI locale pour le développement si nécessaire.
    // process.exit(1); 
}

// --- Middlewares ---
app.use(cors()); 
app.use(express.json()); // Pour que Express puisse lire le corps des requêtes en JSON

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
    price: { type: Number, required: true, min: 0.01 }, // Prix d'achat (renommé de purchasePrice à price)
    minStockLevel: { type: Number, required: true, min: 0 },
}, { timestamps: true });

const Product = mongoose.model('Product', ProductSchema);

// Modèle Vente
const SaleSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    unitPrice: { type: Number, required: true, min: 0.01 }, // Prix de vente
    quantitySold: { type: Number, required: true, min: 1 },
    totalPrice: { type: Number, required: true },
    saleDate: { type: Date, default: Date.now }
});

const Sale = mongoose.model('Sale', SaleSchema);


// ------------------------------------
// 2. Routes de l'API (Endpoints REST)
// ------------------------------------

const API_BASE_URL = '/api';

// Route de test (pour vérifier si le serveur Render est en ligne)
app.get('/', (req, res) => {
    res.status(200).send('Bienvenue sur l\'API StockApp Melchisédech. La base de données est connectée.');
});

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
        // La requête PUT nécessite de s'assurer que si 'name' est modifié,
        // il ne cause pas de conflit d'unicité avec un autre produit.
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
        // On vérifie d'abord si le produit existe pour renvoyer une 404 propre
        const product = await Product.findByIdAndDelete(req.params.id);
        if (!product) {
            return res.status(404).json({ message: "Produit non trouvé." });
        }
        res.status(204).send(); // 204 No Content pour une suppression réussie
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur lors de la suppression.' });
    }
});

// --- B. Ventes (/api/sales) ---

// GET: Récupérer toutes les ventes (Rapport)
app.get(`${API_BASE_URL}/sales`, async (req, res) => {
    try {
        // On utilise populate pour joindre les informations du produit si nécessaire, 
        // mais ici on utilise juste le nom du produit enregistré dans la vente.
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


// ------------------------------------
// 3. Démarrage du Serveur
// ------------------------------------

// Render va automatiquement écouter sur le port exposé.
app.listen(PORT, () => {
    console.log(`🚀 Serveur StockApp Melchisédech démarré. Écoute sur le port ${PORT}`);
});