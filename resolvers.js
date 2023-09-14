const { GraphQLError } = require('graphql')
const jwt = require('jsonwebtoken')
const Book = require('./models/book')
const Author = require('./models/author')
const User = require('./models/user')

const resolvers = {
	Query: {
		bookCount: async () => await Book.collection.countDocuments(),
		authorCount: async () => await Author.collection.countDocuments(),

		allBooks: async (root, args) => {
			let obj = await Book.find({})
			//console.log(obj)
			const query = {}

			if (args.author) {
				const author = await Author.findOne({ name: args.author })
				if (author) {
					query.author = author._id
				} else {
					// If the author doesn't exist, return an empty array
					return []
				}
			}
			if (args.genre) {
				query.genres = { $in: [args.genre] }  // Use $in to match books with the specified genre
			}
			console.log(query)
			const books = await Book.find(query)
			//console.log(books)
			// Map over the books and fetch the additional author info
			const booksWithAuthorInfo = books.map(async (book) => {
				let author = await Author.findById(book.author)

				const authorBooks = await Book.find({ author: author._id })
				const bookCount = authorBooks.length
				console.log(authorBooks)

				return {
					...book.toJSON(),//by calling toJSON() before returning it in your resolver, you ensure that the transformation defined in the schema's toJSON method is applied, and the _id field is correctly transformed to id in the JSON response.
					author: {
						...author.toJSON(),
						bookCount,
						books: authorBooks,
					}
				}
			})
			return Promise.all(booksWithAuthorInfo)
		},

		allAuthors: async () => {
			const authors = await Author.find({})

			const authorPromises = authors.map(async (author) => {

				const authorBooks = await Book.find({ author: author._id })
				const bookCount = authorBooks.length
				return {
					...author.toJSON(),
					bookCount,
					books: authorBooks,
				}
			})
			console.log(authorPromises)
			return Promise.all(authorPromises)
		},

		findAuthor: async (root, args) => {
			let author = await Author.findOne({ name: args.name })
			if (!author) {
				return null
			}
			const authorBooks = await Book.find({ author: author._id })
			const bookCount = authorBooks.length
			return {
				...author.toJSON(),
				bookCount,
				books: authorBooks,
			}
		},

		findBook: async (root, args) => {
			const book = await Book.findOne({ title: args.title })
			console.log(book)
			if (!book) {
				return null
			}
			console.log(book.author)
			const author = await Author.findById(book.author)//book.author here is ObjectId, not an object
			console.log(author)

			const authorBooks = await Book.find({ author: author._id })
			const bookCount = authorBooks.length

			return {
				...book.toJSON(),
				author: {
					...author.toJSON(),
					bookCount,
					books: authorBooks,
				}

			}
		},

		me: (root, args, context) => {
			return context.currentUser
		},
		booksByGenre: async (_, { genre }) => {
			const books = await Book.find({ genres: genre })
			const booksWithAuthorInfo = books.map(async (book) => {
				let author = await Author.findById(book.author)

				const authorBooks = await Book.find({ author: author._id })
				const bookCount = authorBooks.length
				console.log(authorBooks)

				return {
					...book.toJSON(),
					author: {
						...author.toJSON(),
						bookCount,
						books: authorBooks,
					}
				}
			})
			return Promise.all(booksWithAuthorInfo)

		},
		booksByAuthor: async (_, { author }) => {
			const books = await Book.find({ author: author })
			const booksWithAuthorInfo = books.map(async (book) => {
				let author = await Author.findById(book.author)

				const authorBooks = await Book.find({ author: author._id })
				const bookCount = authorBooks.length
				console.log(authorBooks)

				return {
					...book.toJSON(),
					author: {
						...author.toJSON(),
						bookCount,
						books: authorBooks,
					}
				}
			})
			return Promise.all(booksWithAuthorInfo)
		},
	},

	Mutation: {
		addBook: async (root, args, context) => {
			if (args.title.length < 5) {
				throw new GraphQLError('Book title must be at least 5 characters long')
			}

			if (args.author.length < 4) {
				throw new GraphQLError('Author name must be at least 4 characters long')
			}
			let author = await Author.findOne({ name: args.author })
			if (!author) {
				author = new Author({ name: args.author })
				try {
					await author.save()
				} catch (error) {
					throw new GraphQLError('Saving person failed', {
						extensions: {
							code: 'BAD_USER_INPUT',
							invalidArgs: args.name,
							error
						}
					})
				}
			}
			const book = new Book({ ...args, author: author._id })
			const currentUser = context.currentUser
			if (!currentUser) {
				throw new GraphQLError('not authenticated', {
					extensions: { code: 'BAD_USER_INPUT', }
				})
			}
			try {
				await book.save()
			} catch (error) {
				throw new GraphQLError('Saving book failed', {
					extensions: {
						code: 'BAD_USER_INPUT',
						invalidArgs: args.name,
						error
					}
				})
			}
			return book.populate('author')
		},

		editAuthor: async (root, args, context) => {
			const author = await Author.findOne({ name: args.name })
			const currentUser = context.currentUser
			if (!currentUser) {
				throw new GraphQLError('not authenticated', {
					extensions: { code: 'BAD_USER_INPUT', }
				})
			}

			if (!author) {
				return null
			}

			author.born = args.setBornTo
			await author.save()
			const authorBooks = await Book.find({ author: author._id })
			const bookCount = authorBooks.length
			return {
				...author.toJSON(),
				bookCount,
				books: authorBooks,
			}
		},

		createUser: async (root, args) => {
			const user = new User({
				username: args.username,
				favoriteGenre: args.favoriteGenre,
			})

			return user.save()
				.catch(error => {
					throw new GraphQLError('Creating the user failed', {
						extensions: {
							code: 'BAD_USER_INPUT',
							invalidArgs: args.name,
							error
						}
					})
				})
		},
		login: async (root, args) => {
			const user = await User.findOne({ username: args.username })

			if (!user || args.password !== 'secret') {
				throw new GraphQLError('wrong credentials', {
					extensions: {
						code: 'BAD_USER_INPUT'
					}
				})
			}

			const userForToken = {
				username: user.username,
				id: user._id,
			}

			return { value: jwt.sign(userForToken, process.env.JWT_SECRET) }
		},
	}
}

module.exports = resolvers