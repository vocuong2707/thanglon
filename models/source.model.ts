import mongoose, { Model, Schema } from "mongoose";
import { IUser } from "./user.model";
import { title } from "process";

interface IComment extends Document {
    user:IUser,
    question:string,
    questionReplies : IComment[];
}

interface IReview extends Document {
    user:IUser,
    rating:number,
    comment : string,
    commentReplies?:IComment[]
}

interface ILink extends Document {
    title : string,
    url: string,
}

interface ICourse extends Document {
    title: string,
    description : string,
    image : string,
    instructor: object,
    price:number,
    category:string,
    lessons:ILink[],
    reviews: IReview[]
}

interface ICourceData extends Document {
    title:string,
    description : string,
    videoUrl : string,
    videoThumbnail:object,
    videoSection:string,
    videoLength: number,
    videoPlayer:string,
    link:ILink[],
    suggestion : string,
    comments:IComment[],
    questions:IComment[],


}

interface ICourse extends Document {
    name:string,
    description:string,
    categorie:string,
    price:number,
    estimatedPrice?: number,
    thumbnail : object,
    tags:string,
    level:string,
    demoUrl: string,
    benefits: {title:string}[],
    prerequisite: {title: string}[],
    reviews: IReview[],
    courseData : ICourceData[],
    ratings?: number;
    purchased? : number
}

const reviewSchema = new Schema<IReview>({
    user : Object,
    rating: {
        type:Number,
        default:0
    },
    comment:String,
    commentReplies:[Object]
});

const linkSchema = new Schema<ILink>({
    title : String,
    url:String
});

const commentSchema = new Schema<IComment>({
    user:Object,
    question:String,
    questionReplies: [Object],

});

const courseDataSchema = new Schema<ICourceData>({
    videoUrl:String,
    title:String,
    videoSection:String,
    videoPlayer:String,
    videoLength:Number,
    description:String,
    link:[linkSchema],
    questions:[commentSchema],
    suggestion:String
},{timestamps:true});


const courseSchema = new Schema<ICourse>({
    name: {
        type:String,
        required: true,
    },
    description: {
        type:String,
        required:true,
    }, 
    categorie: {
        type:String,
        required:true,
    },
    price: {
        type:Number,
        required:false,
    },
    estimatedPrice: {
        type:Number
    },
    thumbnail : {
        public_id : {
            type:String
        },    
        url:{
            type:String,
        },
    },
    tags : {
        type:String,
        required:true
    },
    level: {
        type:String,
        required:true
    },
    demoUrl: {
        type:String,
        required:true
    },
    benefits: [{
        title: String
    }],
    prerequisite: [{
        title:String,
    }],
    reviews: [reviewSchema],
    courseData: [courseDataSchema],
    ratings: {
        type:Number,
        default:0,
    },
    purchased: {
        type: Number,
        default:1
    }
},{timestamps:true})

const CourseModel : Model<ICourse> = mongoose.model("Course",courseSchema);
export default CourseModel;
