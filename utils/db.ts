import mongoose from 'mongoose';

require('dotenv').config();

const dbUrl:string = process.env.MONGO_URI || '';

const connectDb =async () => {
    try {
        await mongoose.connect(dbUrl).then((data:any) => {
            console.log(`Database connected with ${data.connection.host}`);
        }) 
    } catch (error:any) {
        console.log(error.mesage);
        setTimeout(connectDb,5000)
    }
}

export default connectDb;


