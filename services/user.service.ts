import userModel from "../models/user.model"
import { NextFunction, Response } from "express";
import { redis } from "../utils/redis";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
export const getUserById = async (id:string,res:Response) =>{
    const userJson = await redis.get(id);
    if(userJson) {
        const user = JSON.parse(userJson)     
    
    res.status(201).json({
        success:true,
        user
     })
    }
}

// Get All users
export const getAllUsersService = async(res:Response)=>{
    const users = await userModel.find().sort({createAt:-1});
    res.status(201).json({
        success:true,
        users
    })
};

// get all users --- only for admin
// / update user roles --only for admin
export const updateUserRoleService = async(res:Response,id:string,role:string)=> {
    try {
        const user = await userModel.findByIdAndUpdate(id,{role},{new:true})
        res.status(200).json({
            success:true,
            user
        })
        
    } catch (error) {
        
    }
}