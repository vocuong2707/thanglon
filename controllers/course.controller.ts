import { NextFunction , Request, Response } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import cloudinary from "cloudinary"
import { createCourse, getAllCoursesService } from "../services/course.service";
import { url } from "inspector";
import CourseModel from "../models/source.model";
import { redis } from "../utils/redis";
import mongoose from "mongoose";
import path from "path";
import ejs, { Template } from "ejs"
import sendMail from "../utils/sendMail";
import NotificationModel from "../models/notification.model";
import { getAllUsersService } from "../services/user.service";
import axios from "axios";

export const uploadCourse = CatchAsyncError(async(req:Request , res:Response,next:NextFunction)=> {
    try {
        const data = req.body;
        console.log("ddaaa", data);
        const thumbnail = data.thumbnail;
        if(thumbnail) {
            const myCloud = await cloudinary.v2.uploader.upload(thumbnail,{
                folder:"courses"
            });
            data.thumbnail= {
                public_id : myCloud.public_id,
                url : myCloud.secure_url
            }
        }

        createCourse(data,res,next);
    } catch (error : any) {
        return next(new ErrorHandler(error.message,500));
    }
    console.log("Dữ liệu nhận được từ Frontend:", req.body);
})

//edit
export const editCourse = CatchAsyncError(async(req:Request,res:Response,next:NextFunction)=> {
    try {
        const data = req.body;
        const thumbnail = data.thumbnail;
        if(thumbnail) {
            await cloudinary.v2.uploader.destroy(thumbnail.public_id);
            const myCloud = await cloudinary.v2.uploader.upload(thumbnail,{
                folder:"courses",
            });

            data.thumbnail = {
                public_id : myCloud.public_id,
                url: myCloud.secure_url
            };
        }

        const courseId = req.params.id;
        const course = await CourseModel.findByIdAndUpdate(courseId,{
            $set: data},
            {new : true}
        );
        
        res.status(200).json({
            success:true,
            course
        })
    } catch (error : any) {
        return next(new ErrorHandler(error.message,500));

    }
})


// get single course ---- with purchasing

export const getSingleCourse = CatchAsyncError(async(req:Request , res:Response, next:NextFunction)=> {
    try {
        const courseId = req.params.id;
        const isCacheExist = await redis.get(courseId);
        if(isCacheExist) {
            const course = JSON.parse(isCacheExist);
            res.status(200).json({
                success:true,
                course
            })
        }
       else {
        const course = await CourseModel.findById(req.params.id).select("-courseData.videoUrl -courseData.suggestion -courseData.question -courseData.links");
        await redis.set(courseId,JSON.stringify(course),'EX',60602)

        res.status(200).json({
            success:true,
            course
        })
       }
    } catch (error:any) {
        return next(new ErrorHandler(error.message,500))
    }
})

// get all course
export const getAllCourse = CatchAsyncError(async(req:Request,res:Response,next:NextFunction)=> {
    try {
        const isCacheExist = await redis.get("allCourses");

        if(isCacheExist) {
            const courses = JSON.parse(isCacheExist);
            res.status(200).json({
                success:true,
                courses
            })
        }
        else {
            const courses = await CourseModel.find().select("-courseData.videoUrl -courseData.suggestion -courseData.question -courseData.links");
            await redis.set("allCourses",JSON.stringify(courses))
            res.status(200).json({ 
                success:true,
                courses
            });
        }
    } catch (error:any) {
        return next(new ErrorHandler(error.message,500))

    }
})


// get course content -- only for valid user
export const getCourseByUser = CatchAsyncError(async(req:Request, res:Response,next: NextFunction)=> {
    try {
        const userCourseList = req.user?.courses;
        const courseId = req.params.id;
        const courseExists = userCourseList?.find((course:any)=>course._id.toString() === courseId);

        console.log('====================================');
        console.log(courseId);
        console.log('====================================');
        if(!courseExists) {
            return next(new ErrorHandler("You are not eligible to access this course",404))
        }
        const course = await CourseModel.findById(courseId);
        const content = course?.courseData;
        res.status(200).json({
            success : true,
            content
        })
    } catch (error) {
        
    }
})

// add question in course
interface IAddQuestion {
    question:string,
    courseId : string,
    contentId: string,
}

export const addQuestion = CatchAsyncError(async(req:Request,res:Response,next:NextFunction)=> {
    try {
        const {question,courseId,contentId} : IAddQuestion = req.body;
        const course = await CourseModel.findById(courseId);

        if(!mongoose.Types.ObjectId.isValid(contentId)) {
            return next(new ErrorHandler("Invalid content id",400))
        }

        const courseContent = course?.courseData.find((item:any) =>item._id.equals(contentId));
        if(!courseContent) {
            return next(new ErrorHandler("Invalid content id",400))
        }
        // create a new question object
        const newQuestion : any = {
            user: req.user,
            question,
            questionReplies:[],
        }

        // add this question to our course content
        courseContent.questions.push(newQuestion);

        await NotificationModel.create({
            user:req.user?._id,
            title:"New Question",
            message:`You have a new question in ${courseContent?.title}`,
        });
        // save the update course
        await course?.save();
        res.status(200).json({
            success:true,
            course
        })


    } catch (error : any) {
        return next(new ErrorHandler(error.message,500));
    }
})

// add answer in course question

interface IAddAnswer {
    answer:string,
    courseId : string,
    contentId:string,
    questionId:string
}

export const addAnswer = CatchAsyncError(async(req:Request,res:Response,next:NextFunction) => {
    try {
        const {answer , courseId,contentId,questionId} :IAddAnswer = req.body;
        const course = await CourseModel.findById(courseId);

        if(!mongoose.Types.ObjectId.isValid(contentId)) {
            return next(new ErrorHandler("Invalid content id",400))
        }

        const courseContent = course?.courseData.find((item:any) =>item._id.equals(contentId));
        if(!courseContent) {
            return next(new ErrorHandler("Invalid content id",400))
        }

        const question = courseContent?.questions?.find((item:any)=>
            item._id.equals(questionId)
        );

        if(!question) {
            return next(new ErrorHandler("Invalid question id",400))
        }

        // create a new answer object
        const newAnswer:any = {
            user:req.user,
            answer,
        }

        // add this answer to our course content
        question.questionReplies.push(newAnswer);
        await course?.save();
        if(req.user?._id === question.user._id) {
            // create a not notification
            await NotificationModel.create({
                user:req.user?.id,
                title:"New Question Reply Received",
                message:`You have a new question reply in ${courseContent.title}`
            })
        }else {
            const data = {
                name:question.user.name,
                title:courseContent.title,
            }
            const html = await ejs.renderFile(path.join(__dirname,"../mails/question-reply.ejs"),data);

            try {
                await sendMail({
                    email:question.user.email,
                    subject: "Question Reply",
                    template:"question-reply.ejs",
                    data
                })
            } catch (error:any) {
                return next(new ErrorHandler(error.message,500));

            }
        }
        res.status(200).json({
            success:true,
            course
        })
    } catch (error:any) {
        return next(new ErrorHandler(error.message,500));

    }
})

// add review in course
interface IAddReviewData {
    review:string,
    courseId:string,
    rating:number,
    userId:string,
}

export const addReview = CatchAsyncError(async(req:Request , res:Response,next:NextFunction)=> {
    try {
        const userCourseList = req.user?.courses;
        const courseId = req.params.id;
        // check if courseId already exists in userCourseList based on _id
        const courseExists = userCourseList?.some((course:any)=> course._id.toString() ===courseId.toString());
        if(!courseExists) {
            return next(new ErrorHandler("You are not eligible to access this course",404));
        }
        const course = await CourseModel.findById(courseId);
        const {review,rating} = req.body as IAddReviewData;
        const reviewData:any = {
            user:req.user,
            comment:review,
            rating,
        }
        course?.reviews.push(reviewData);

        let avg = 0;
        course?.reviews.forEach((rev:any)=>{
            avg +=rev.rating
        });
        if(course) {
            course.ratings = avg / course.reviews.length; // vi du 2 nguoi review , 1 ng 4 1 ng 5 thi co gia tri = 9/2 = 4.5 ratings
        }

        await course?.save();

        const notification = {
            title:"New review Received",
            message:`${req.user?.name} has given a review in ${courses?.name}`
        }

        // create notification 
        res.status(200).json({
            success:true,
            courses
        })

    } catch (error:any) {
        return next(new ErrorHandler(error.message,500));

    }
})

// add reply in review
interface IAddReviewData {
    comment : string,
    courseId:string,
    reviewId:string
}
export const addReplyToReview = CatchAsyncError(async(req:Request,res:Response,next:NextFunction)=> {
    try {
        const {comment,courseId, reviewId} = req.body as IAddReviewData;
        const course = await CourseModel.findById(courseId);
        if(!course) {
            return next(new ErrorHandler("Course not found",400));

        }

        const review = course.reviews.find((rev:any)=>rev._id.toString() === reviewId);
        if(!review) {
            return next(new ErrorHandler("Review not found",400));

        }

        const replyData :any = {
            user:req.user,
            comment
        }

        if(!review.commentReplies) {
            review.commentReplies = [];
        }
        review.commentReplies?.push(replyData);
        await course.save();
        res.status(200).json({
            success:true,
            course
        })
    } catch (error:any) {
        return next(new ErrorHandler(error.message,500));

    }
})
// getAdminAllCourse
export const getAdminAllCourses = CatchAsyncError(
    async (req:Request,res:Response,next:NextFunction) => {
        try {
            getAllCoursesService(res);
        } catch (error:any) {
            return next(new ErrorHandler(error.message,400))

        }
    }
);


// delete course -- only for admin
export const deleteCourse = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        // Tìm khóa học trong MongoDB
        const course = await CourseModel.findById(id);
        if (!course) {
            return next(new ErrorHandler("Course not found", 404));
        }

        // Xóa khóa học trong MongoDB
        await course.deleteOne();

        // Lấy dữ liệu từ Redis
        const courses = JSON.parse(await redis.get('allCourses')) || [];

        // Xóa khóa học khỏi danh sách trong Redis
        const updatedCourses = courses.filter(course => course._id !== id);

        // Lưu lại dữ liệu đã cập nhật vào Redis
        await redis.set('allCourses', JSON.stringify(updatedCourses));

        res.status(200).json({
            success: true,
            message: "Course deleted successfully from MongoDB and Redis",
        });
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});

// GENERATE VIDEO URL
export const generateVideoUrl = CatchAsyncError(async(req:Request , res:Response,next:NextFunction) => {
    try {
        const {videoId} = req.body; 
        const response = await axios.post(
            `https://dev.vdocipher.com/api/videos/${videoId}/otp`,
            {ttl:300},
            {
                headers:{
                    Accept:'application/json',
                    'Content-Type' : 'application/json',
                    Authorization:`Apisecret ${process.env.VDOCIPHER_API_SECRET}`,
                },
            }
        );
        res.json(response.data)
    } catch (error:any) {
        return next(new ErrorHandler(error.message,400))

    }
})