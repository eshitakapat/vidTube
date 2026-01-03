import {Router} from "express";

import { registerUser , logoutUser, loginUser, refreshAccessToken, changeCurrentPassword, getCurrentUser, updateAccountDetails, updateUserCoverImage } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";

const router = Router()

// /api/v1/healthcheck/test

//unsecured routes
router.route("/register").post(
    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        } , {
            name: "coverImage",
            maxCount: 1
        }
    ]),
    registerUser)

    router.route("/login").post(loginUser)
    router.route("/refresh-token").post(refreshAccessToken)


    //secured routes

    router.route("/logout").post(verifyJWT , logoutUser)
    router.route("/change-password").post(verifyJWT , changeCurrentPassword)
    router.route("/current-user").get(verifyJWT , getCurrentUser)
    router.route("/update-account").patch(verifyJWT , updateAccountDetails)
    router.route("/avatar").patch(verifyJWT , upload.single("avatar") ,  updateUserAvatar)
      router.route("/cover-image").patch(verifyJWT , upload.single("coverImage") ,  updateUserCoverImage)



export default router