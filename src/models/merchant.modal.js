import mongoose, {Schema} from "mongoose";

const merchantSchema = new Schema(
    {
        uniqueId: {
            type: String,
            unique: true,
            index: true
        },
        name: {
            type: String,
            required: true,
            trim: true, 
            index: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true, 
        },
        phone: {
            type: String,
            trim: true, 
        },
        password: {
            type: String,
            required: true
        },
        wallet: {
            type: String,
            required: true,
            trim: true, 
        },
        merchantFee: {
            type: Number,
            required: true,
            default: 0
        },
        adminFee: {
            type: Number,
            required: true,
            default: 0
        },
        status: {
            type: Number,
            default: 0, 
            enum: [0, 1]
        },
        apiKey: {
            type: String,
            default: null
        },
        secretKey: {
            type: String,
            default: null
        },
        paymentProviders: [{
            type: Schema.Types.ObjectId,
            ref: "PaymentProvider"
        }]
    },
    {
        timestamps: true
    }
);

merchantSchema.pre('save', async function(next) {
    if (!this.uniqueId) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let uniqueId = '';
        for (let i = 0; i < 8; i++) {
            uniqueId += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        const existingMerchant = await this.constructor.findOne({ uniqueId });
        if (existingMerchant) {
            // Regenerate if not unique
            uniqueId = '';
            for (let i = 0; i < 8; i++) {
                uniqueId += chars.charAt(Math.floor(Math.random() * chars.length));
            }
        }
        
        this.uniqueId = uniqueId;
    }
    next();
});

export const Merchant = mongoose.model("Merchant", merchantSchema);