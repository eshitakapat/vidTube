import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.models.js"
import { uploadCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"

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

export { registerUser , loginUser }
