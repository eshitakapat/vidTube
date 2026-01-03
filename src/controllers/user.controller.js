import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.models.js"
import { uploadCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"

const generateAccessAndRefreshToken = async (userId) => {
 try {
   const user = await User.findById(userId)
   const accessToken = user.generateAccessToken()
   const refreshToken = user.generateRefreshToken()
 
   user.refreshToken = refreshToken
   await user.save({validateBeforeSave: false})
   return {accessToken , refreshToken}
 } catch (error) {
  throw new ApiError(500 , "Something went wrong while generating access and refresh tokens")
 }
}

const registerUser = asyncHandler(async (req, res) => {
  const { fullname, email, username, password } = req.body

  if ([fullname, email, username, password].some(field => field?.trim() === "")) {
    throw new ApiError(400, "All fields are required")
  }

  const existingUser = await User.findOne({
    $or: [{ email }, { username }]
  })

  if (existingUser) {
    throw new ApiError(409, "User with email or username already exists")
  }

  // FILES
  const avatarLocalPath = req.files?.avatar?.[0]?.path
  const coverLocalPath = req.files?.coverImage?.[0]?.path

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar is required")
  }

  // Upload images
  const avatar = await uploadCloudinary(avatarLocalPath)

  let coverImage = null
  if (coverLocalPath) {
    coverImage = await uploadCloudinary(coverLocalPath)
  }

  // Create user
  const user = await User.create({
    fullname,
    email,
    username: username.toLowerCase(),
    password,
    avatar: avatar.url,
    coverImage: coverImage?.url || ""
  })

  const createdUser = await User.findById(user._id).select("-password -refreshToken")

  return res.status(201).json(
    new ApiResponse(201, createdUser, "User registered successfully")
  )
})

const loginUser = asyncHandler(async (req, res) => {
  const {email , username , password} = req.body

  if (!email) {
    throw new ApiError(400 , "Email is required");
  }

const user = await User.findOne({
    $or: [{ email }, { username }]
  })

  if (!user) {
    throw new ApiError(404 , "User Not Found")
  }

  //validate password

  const isPasswordValid = await user.isPasswordCorrect(password)

  if (!isPasswordValid) {
    throw new ApiError(401 , "Invalid Credentials")
  }

  const {accessToken , refreshToken} = await generateAccessAndRefreshToken(user._id)

  const loggedInUser = await User.findById(user._id).
  select("-password -refreshToken");

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",

  }

  return res
  .status(200)
  .cookie("accessToken" , accessToken , options)
  .cookie("refreshToken" , refreshToken , options)
  .json(new ApiResponse(200 , 
    {user: loggedInUser , accessToken , refreshToken},
    "User logged in successfully"
  ))

})

const logoutUser = asyncHandler(async (req , res) => {
  await User.findByIdAndUpdate(
   req.user._id,
   {
    $set: {
      refreshToken: undefined,

    }
   },
   {new: true}

  )

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  }

  return res
  .status(200)
  .clearCookie("accessToken" , options)
  .clearCookie("refreshToken" , options)
  .json(new ApiResponse(200 , {} , "User Logged Out successfully"))
})

const refreshAccessToken = asyncHandler(async (req , res) => {
const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

if (!incomingRefreshToken) {
  throw new ApiError(401 , "Refresh token is required")
}

try {
  jwt.verify(
    incomingRefreshToken, 
    process.env.REFRESH_TOKEN_SECRET
  )
  const user = await User.findById(decodedToken?._id)

  if (!user) {
    throw new ApiError(401 , "Invalid refresh token")
  }

  if(incomingRefreshToken !== user?.refreshToken) {
throw new ApiError(401 , "Invalid refresh token")
  }
 
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  }

  const {accessToken , refreshToken: newRefreshToken} = await generateAccessAndRefreshToken(user._id)

  return res
  .status(200)
  .cookie("acessToken" , accessToken ,options)
  .cookie("refreshToken" , newRefreshToken , options)
  .json(
    new ApiResponse(
      200 , 
      {
        accessToken , 
        refreshToken: newRefreshToken
      },
      "Access token refreshed sucessfully"
    )
  )

} catch (error) {
  
}


})

const changeCurrentPassword = asyncHandler(async (req ,res) => {


  const {oldPassword, newPassword} = req.body
  const user = await User.findById(req.user?._id)
  user.isPasswordCorrect(oldPassword)
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
  if (!isPasswordValid) {
    throw new ApiError(401, "Old password is incorrect")
  }

  user.password = newPassword
  await user.save({validateBeforeSave: false})

  return res.status(200).json(new ApiResponse(200 , {}, "Password changed successfully"))
})

const getCurrentUser = asyncHandler(async (req ,res) => {
  return res.status(200).json(new ApiResponse(200 , req.user, "Current user details"))
})

const updateAccountDetails = asyncHandler(async (req ,res) => {
const {fullname , email} = req.body
if (!fullname || !email) {
  throw new ApiError(400 , "Fullname and email are required ")
}



const user = await User.findByIdAndUpdate(
  req.user?._id,
  {
    $set: {
      fullname,
      email: email
    }
  },

  {new: true}
).select("-password -refreshToken")

return res.status(200).json(new ApiResponse(200 , user , "Account details updated successfully"))

})

const updateUserAvatar = asyncHandler(async (req ,res) => {
  const avatarLocalPath = req.files?.path

  if(!avatarLocalPath) {
    throw new ApiError(400 , "File is required")
  }

  const avatar = await uploadCloudinary(avatarLocalPath)

  if (!avatar.url) {
    throw new ApiError(500 , "Something went wrong while uploading avatar")
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url
      }
    },
    {new: true}
  ).select("-password -refreshToken")

  res.status(200).json( new ApiResponse(200 , user , "Avatar updated successfully"))

})

const updateUserCoverImage = asyncHandler(async (req ,res) => {
const coverImageLocalPath = req.file?.path

if (!coverImageLocalPath) {
  throw new ApiError(400 , "File is required")
}

const coverImage = await uploadCloudinary(coverImageLocalPath)

if(!coverImage.url)
{
  throw new ApiError(500 , "Something went wrong")
}

const user = await User.findByIdAndUpdate(
  req.user?._id,
  {
    $set:
    {
      coverImage: coverImage.url
    }
  },
  {new: true}
).select("-password -refreshToken")

return res.status(200).json(new ApiResponse(200 , user , "Cover Image updated"))
})


export { registerUser , loginUser , refreshAccessToken , logoutUser , changeCurrentPassword , getCurrentUser , updateAccountDetails , updateUserAvatar, updateUserCoverImage}
