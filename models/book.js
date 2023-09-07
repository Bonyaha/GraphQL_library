const mongoose = require('mongoose')

// you must install this library
const uniqueValidator = require('mongoose-unique-validator')

const bookSchema = new mongoose.Schema({
	title: {
		type: String,
		required: true,
		unique: true,
		minlength: 5
	},
	published: {
		type: Number,
	},
	author: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Author'
	},
	genres: [
		{ type: String }
	]
})
bookSchema.plugin(uniqueValidator)

/* Q: tell me this: am I right, that this transformation (bookSchema.set('toJSON'...) - it's not a way for a setting a whole new method, it's just modification of already existing method of Mongoose library, isn't it?
A: Yes, you are correct. The `bookSchema.set('toJSON', ...)` code is not creating a new method in your Mongoose schema. Instead, it is modifying the existing `toJSON` method provided by the Mongoose library.
The `toJSON` method is a built-in method in Mongoose that controls how Mongoose documents are serialized to JSON when you call `JSON.stringify()` on them or return them as JSON from your API. By using `bookSchema.set('toJSON', ...)`, you are customizing the behavior of this existing method for instances of your `Book` schema.
In your customization, you are changing how the document is transformed into a JSON object by renaming the `_id` field to `id` and removing the `_id` and `__v` fields from the JSON output. This allows you to control the shape of the JSON objects returned in your API responses.
So, in summary, you are modifying the behavior of the existing `toJSON` method to fit your specific requirements for JSON serialization.

Q: so it wouldn't be false to say that in it's 'pure' looking, without this modification, this toJSON method is the same as toObject?
A: Yes, in its default behavior, the `toJSON` method in Mongoose is similar to the `toObject` method. Both methods are used for serializing Mongoose documents into JavaScript objects, but there are some differences in their default behavior:
1. `toJSON`:
	 - The `toJSON` method is used when you explicitly call `JSON.stringify()` on a Mongoose document or return the document as JSON from your API.
	 - By default, it includes all fields in the document, including `_id` and `__v`.
	 - You can customize its behavior using the `bookSchema.set('toJSON', ...)` approach, as you demonstrated in your code, to control which fields are included and their names.
2. `toObject`:
	 - The `toObject` method is used when you convert a Mongoose document to a plain JavaScript object using `toObject()`.
	 - By default, it includes all fields in the document, including `_id` and `__v`.
	 - You can use the `toObject()` method without customizations, and it will return a plain object representation of the document.
So, while both methods serve a similar purpose, `toJSON` is typically used when you want to control how the document is serialized to JSON for API responses, while `toObject` is used for converting a Mongoose document to a plain JavaScript object in other parts of your code. */
bookSchema.set('toJSON', {
	transform: (document, returnedObject) => {
		returnedObject.id = returnedObject._id.toString()
		delete returnedObject._id
		delete returnedObject.__v
	},
})


module.exports = mongoose.model('Book', bookSchema)