import mongoose from 'mongoose';
import crypto from 'crypto';

// ✅ Polyfill for missing global crypto
if (typeof globalThis.crypto === 'undefined') {
    globalThis.crypto = crypto;
}

const connect = async () => {
    if (mongoose.connection.readyState >= 1) {
        console.log('MongoDB already connected (readyState:', mongoose.connection.readyState + ')');
        return;
    }

    try {
        // ✅ Case-sensitive! MongoDB_URI ya MONGODB_URI - jo Heroku pe set hai wahi use karo
        const mongoURI = "mongodb+srv://admin:admin@cluster0.osy5bio.mongodb.net/variance";  // Heroku pe MONGODB_URI hai
        // const mongoURI = "mongodb://localhost:27017/variance"

        if (!mongoURI) {
            throw new Error('MONGODB_URI environment variable is not set');
        }

        await mongoose.connect(mongoURI);
        console.log('✅ MongoDB connected successfully');

        // Connection ke baad bufferCommands false karo
        mongoose.set('bufferCommands', false);
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        throw error;
    }
};

export { connect };