// script.js - Logique Frontend (Asynchrone avec API REST)

// -----------------------------------------------------------------
// 1. Initialisation des Sélecteurs DOM et URL
// -----------------------------------------------------------------

// --- À METTRE À JOUR APRÈS LE DÉPLOIEMENT SUR RENDER ---
// L'URL DOIT pointer vers l'URL publique de votre service Render, suivi de /api
// EXEMPLE: const API_BASE_URL = 'https://stockapp-melchisedech.onrender.com/api';
const API_BASE_URL = 'https://new-stockapp-melchisedech.onrender.com/api'; // URL du service Render pour le développement
// --------------------------------------------------------

// Sélecteurs DOM
const views = {
    list: document.getElementById('product-list-view'),
    productForm: document.getElementById('product-form-view'),
    saleForm: document.getElementById('sale-form-view'),
    saleReport: document.getElementById('sale-report-view'),
    about: document.getElementById('about-view')
};
const productTbody = document.getElementById('product-tbody');
const emptyStockMessage = document.getElementById('empty-stock-message');
const alertContainer = document.getElementById('alert-container');
const productForm = document.getElementById('product-form');
const productIdInput = document.getElementById('product-id');
const formTitle = document.getElementById('form-title');
const saleForm = document.getElementById('sale-form');
const saleProductSelect = document.getElementById('sale-product-id');
const saleQuantityInput = document.getElementById('sale-quantity');
const saleErrorDiv = document.getElementById('sale-error');
const saleUnitPriceInput = document.getElementById('sale-unit-price');
const saleTotalPriceInput = document.getElementById('sale-total-price');
const saleReportTbody = document.getElementById('sale-report-tbody');
const saleReportTfoot = document.getElementById('sale-report-tfoot');
const emptySalesMessage = document.getElementById('empty-sales-message');
const mainModal = document.getElementById('main-modal');
const modalMessage = document.getElementById('modal-message');
const modalConfirmBtn = document.getElementById('modal-confirm-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');


// -----------------------------------------------------------------
// 2. Fonctions d'Utilité et Modales
// -----------------------------------------------------------------

/** Affiche une notification ou une erreur utilisateur (remplace alert()) */
const showNotification = (message, type = 'error', duration = 5000) => {
    // Utilise l'alertContainer existant pour afficher des messages temporaires
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} fade-in`;
    notification.textContent = message;
    alertContainer.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('fade-out');
        notification.addEventListener('transitionend', () => notification.remove());
    }, duration);
};

/** Gère les erreurs de Fetch */
const handleFetchError = (error, operation) => {
    console.error(`Erreur ${operation}:`, error);
    showNotification(`Opération échouée (${operation}). Détail: ${error.message}`, 'error', 10000);
    return null;
};

/** Affiche une modale de confirmation (remplace confirm()) */
const showConfirmationModal = (message) => {
    return new Promise(resolve => {
        modalMessage.textContent = message;
        modalConfirmBtn.onclick = () => {
            mainModal.style.display = 'none';
            resolve(true);
        };
        modalCancelBtn.onclick = () => {
            mainModal.style.display = 'none';
            resolve(false);
        };
        mainModal.style.display = 'flex';
    });
};


// -----------------------------------------------------------------
// 3. Fonctions de Communication avec l'API
// -----------------------------------------------------------------

const getProducts = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/products`);
        if (!response.ok) throw new Error(`Status ${response.status}`);
        return await response.json(); 
    } catch (error) {
        // En cas d'échec du backend, on retourne un tableau vide et on notifie l'utilisateur
        return handleFetchError(error, 'Récupération des produits') || [];
    }
};

const getSales = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/sales`);
        if (!response.ok) throw new Error(`Status ${response.status}`);
        return await response.json();
    } catch (error) {
        return handleFetchError(error, 'Récupération des ventes') || [];
    }
};

const saveProductToDB = async (productData) => {
    const isEditing = productData.id;
    const url = isEditing ? `${API_BASE_URL}/products/${productData.id}` : `${API_BASE_URL}/products`;
    const method = isEditing ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(productData)
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || `Status ${response.status}`);
        }
        showNotification(`Produit ${isEditing ? 'mis à jour' : 'ajouté'} avec succès!`, 'success', 3000);
        return data; 
    } catch (error) {
        return handleFetchError(error, 'Sauvegarde/Mise à jour du produit');
    }
};

const deleteProductFromDB = async (id, name) => {
    // Utilisation de la modale de confirmation
    const confirmed = await showConfirmationModal(`Êtes-vous sûr de vouloir supprimer le produit "${name}" ? Cette action est irréversible.`);
    if (!confirmed) return false;
    
    try {
        const response = await fetch(`${API_BASE_URL}/products/${id}`, { method: 'DELETE' });
        
        if (response.status === 204) {
            showNotification(`Produit "${name}" supprimé.`, 'success', 3000);
            return true;
        }
        
        const data = await response.json();
        throw new Error(data.message || `Status ${response.status}`);
    } catch (error) {
        return handleFetchError(error, 'Suppression du produit') || false;
    }
};

const saveSaleToDB = async (saleData) => {
    try {
        const response = await fetch(`${API_BASE_URL}/sales`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(saleData)
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || `Status ${response.status}`);
        }
        showNotification(`Vente de ${saleData.quantitySold} unités enregistrée !`, 'success', 3000);
        return data;
    } catch (error) {
        // Le backend renvoie souvent ici une erreur de stock insuffisant
        return handleFetchError(error, 'Enregistrement de la vente');
    }
};


// -----------------------------------------------------------------
// 4. Fonctions de Rendu (Asynchrones)
// -----------------------------------------------------------------

const showView = async (viewName) => {
    Object.values(views).forEach(view => view.style.display = 'none');
    views[viewName].style.display = 'block';
    
    // Réinitialisation des messages d'alerte et des formulaires
    alertContainer.innerHTML = '';
    saleErrorDiv.style.display = 'none';

    if (viewName === 'saleForm') {
        await populateSaleProductSelect();
    } else if (viewName === 'saleReport') {
        await renderSaleReport();
    } else if (viewName === 'list') {
        await renderProductList();
    }
};

const renderProductList = async () => {
    const products = await getProducts();
    productTbody.innerHTML = ''; 
    let lowStockCount = 0;

    if (products.length === 0) {
        emptyStockMessage.style.display = 'block';
        return;
    }

    emptyStockMessage.style.display = 'none';

    products.forEach(product => {
        // Correction de la vérification de stock : price n'est pas utilisé pour la quantité
        const isLowStock = product.quantity <= product.minStockLevel;
        if (isLowStock) lowStockCount++;

        const row = productTbody.insertRow();
        row.className = isLowStock ? 'low-stock' : '';

        row.insertCell().textContent = product.name;
        row.insertCell().textContent = product.quantity;
        row.insertCell().textContent = product.price.toFixed(2) + ' €'; // Prix d'achat
        row.insertCell().textContent = product.minStockLevel;

        const actionCell = row.insertCell();
        
        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn-warning btn-small';
        editBtn.textContent = 'Modifier';
        editBtn.onclick = () => editProduct(product._id); 
        actionCell.appendChild(editBtn);
        
        actionCell.appendChild(document.createTextNode(' ')); 

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-danger btn-small';
        deleteBtn.textContent = 'Supprimer';
        deleteBtn.onclick = async () => { 
            const success = await deleteProductFromDB(product._id, product.name);
            if(success) await renderProductList();
        };
        actionCell.appendChild(deleteBtn);
    });
    
    if (lowStockCount > 0) {
        alertContainer.innerHTML = `
            <div class="alert alert-low-stock">
                ⚠️ **ATTENTION !** ${lowStockCount} produit(s) sont en **stock faible** (sous le seuil minimum).
            </div>
        `;
    } else {
        alertContainer.innerHTML = '';
    }
};

const renderSaleReport = async () => {
    const sales = await getSales();
    saleReportTbody.innerHTML = '';
    saleReportTfoot.innerHTML = '';
    
    let totalRevenue = 0;
    const reportActions = document.querySelector('.report-actions'); 

    if (sales.length === 0) {
        emptySalesMessage.style.display = 'block';
        if (reportActions) reportActions.style.display = 'none';
        return;
    }
    emptySalesMessage.style.display = 'none';
    if (reportActions) reportActions.style.display = 'block';

    sales.forEach(sale => {
        totalRevenue += sale.totalPrice;

        const row = saleReportTbody.insertRow();
        const date = new Date(sale.saleDate);
        const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;

        row.insertCell().textContent = formattedDate;
        row.insertCell().textContent = sale.productName;
        row.insertCell().textContent = sale.unitPrice.toFixed(2) + ' €';
        row.insertCell().textContent = sale.quantitySold;
        row.insertCell().textContent = sale.totalPrice.toFixed(2) + ' €';
    });

    const totalRow = saleReportTfoot.insertRow();
    const totalHeader = document.createElement('th');
    totalHeader.colSpan = 4;
    totalHeader.textContent = 'Revenu Total Généré :';
    totalRow.appendChild(totalHeader);
    
    const revenueCell = document.createElement('th');
    revenueCell.textContent = `${totalRevenue.toFixed(2)} €`;
    totalRow.appendChild(revenueCell);
};


// -----------------------------------------------------------------
// 5. Gestion des Formulaires
// -----------------------------------------------------------------

const editProduct = async (id = null) => {
    productForm.reset();
    productIdInput.value = '';
    
    if (id !== null) {
        const products = await getProducts();
        const product = products.find(p => p._id === id); 
        if (product) {
            formTitle.textContent = `Modifier le Produit : ${product.name}`;
            productIdInput.value = product._id;
            document.getElementById('name').value = product.name;
            document.getElementById('quantity').value = product.quantity;
            document.getElementById('price').value = product.price; // prix d'achat
            document.getElementById('minStockLevel').value = product.minStockLevel;
        }
    } else {
        formTitle.textContent = "Ajouter un Nouveau Produit";
    }
    
    showView('productForm');
};

productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = productIdInput.value;
    
    const productData = {
        // Utilise l'opérateur spread pour inclure l'id uniquement si on édite
        ...(id && { id }), 
        name: document.getElementById('name').value,
        quantity: parseInt(document.getElementById('quantity').value),
        price: parseFloat(document.getElementById('price').value), // prix d'achat
        minStockLevel: parseInt(document.getElementById('minStockLevel').value)
    };
    
    const savedProduct = await saveProductToDB(productData);

    if (savedProduct) {
        showView('list'); 
    }
});

const calculateSalePrices = () => {
    // Permet de gérer les virgules ou les points pour la saisie décimale
    let unitPriceString = saleUnitPriceInput.value.replace(',', '.'); 
    const unitPrice = parseFloat(unitPriceString) || 0;
    const quantity = parseFloat(saleQuantityInput.value) || 0;
    const totalPrice = unitPrice * quantity;
    saleTotalPriceInput.value = totalPrice.toFixed(2);
};

const populateSaleProductSelect = async () => {
    const products = await getProducts();
    saleProductSelect.innerHTML = '<option value="">-- Sélectionner un produit --</option>'; 
    
    products.forEach(product => {
        const option = document.createElement('option');
        option.value = product._id;
        option.textContent = `${product.name} (Stock: ${product.quantity})`;
        
        // Stocker le prix d'achat (price) pour l'utiliser comme base pour la suggestion de prix de vente
        option.dataset.price = product.price; 
        option.dataset.quantity = product.quantity;

        if (product.quantity <= 0) {
            option.disabled = true;
            option.textContent += ' - Épuisé';
        }
        
        saleProductSelect.appendChild(option);
    });
    
    saleErrorDiv.style.display = 'none'; 
    saleForm.reset(); 
    saleUnitPriceInput.value = '0.00';
    saleTotalPriceInput.value = '0.00';
};

saleProductSelect.addEventListener('change', () => {
    const selectedOption = saleProductSelect.options[saleProductSelect.selectedIndex];
    // Récupère le prix d'achat
    const purchasePrice = selectedOption && selectedOption.dataset.price ? parseFloat(selectedOption.dataset.price) : 0;

    // Suggestion d'un prix de vente (par exemple, 50% de marge, soit x 1.5)
    saleUnitPriceInput.value = (purchasePrice * 1.5).toFixed(2);
    
    calculateSalePrices();
});

saleQuantityInput.addEventListener('input', calculateSalePrices);
saleUnitPriceInput.addEventListener('input', calculateSalePrices); 

saleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    saleErrorDiv.style.display = 'none';

    const productId = saleProductSelect.value;
    const quantitySold = parseInt(saleQuantityInput.value);
    const unitPriceSold = parseFloat(saleUnitPriceInput.value.replace(',', '.'));

    if (!productId || quantitySold <= 0 || isNaN(quantitySold) || unitPriceSold <= 0 || isNaN(unitPriceSold)) {
        saleErrorDiv.textContent = "Veuillez vérifier les champs (produit, quantité, prix unitaire).";
        saleErrorDiv.style.display = 'block';
        return;
    }
    
    const saleData = {
        productId: productId,
        quantitySold: quantitySold,
        unitPrice: unitPriceSold 
    };

    const saleResult = await saveSaleToDB(saleData);

    if (saleResult) {
        showView('list');
    }
});


// -----------------------------------------------------------------
// 6. Événements Globaux et Démarrage
// -----------------------------------------------------------------

document.getElementById('print-report-btn').onclick = () => {
    window.print(); 
};

document.getElementById('show-add-btn').onclick = () => editProduct(null);
document.getElementById('show-sell-btn').onclick = () => showView('saleForm');
document.getElementById('show-report-btn').onclick = () => showView('saleReport');
document.getElementById('show-about-btn').onclick = () => showView('about'); 

document.getElementById('cancel-form-btn').onclick = () => showView('list');
document.getElementById('cancel-sale-btn').onclick = () => showView('list');
document.getElementById('cancel-about-btn').onclick = () => showView('list'); 

document.addEventListener('DOMContentLoaded', () => {
    showView('list');
});
