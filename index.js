const { ApolloServer } = require('@apollo/server')
const { startStandaloneServer } = require('@apollo/server/standalone')
const mongoose = require('mongoose')
mongoose.set('strictQuery', false)
require('dotenv').config()
const { GraphQLError } = require('graphql')
const Book = require('./models/book')
const Author = require('./models/author')
const User = require('./models/user')
const jwt = require('jsonwebtoken')


const MONGODB_URI = process.env.MONGODB_URI

console.log('connecting to', MONGODB_URI)

mongoose.connect(MONGODB_URI)
	.then(() => {
		console.log('connected to MongoDB')
	})
	.catch((error) => {
		console.log('error connection to MongoDB:', error.message)
	})


let authors = [
	{
		name: 'Robert Martin',
		id: "afa51ab0-344d-11e9-a414-719c6709cf3e",
		born: 1952,
	},
	{
		name: 'Martin Fowler',
		id: "afa5b6f0-344d-11e9-a414-719c6709cf3e",
		born: 1963
	},
	{
		name: 'Fyodor Dostoevsky',
		id: "afa5b6f1-344d-11e9-a414-719c6709cf3e",
		born: 1821
	},
	{
		name: 'Joshua Kerievsky', // birthyear not known
		id: "afa5b6f2-344d-11e9-a414-719c6709cf3e",
	},
	{
		name: 'Sandi Metz', // birthyear not known
		id: "afa5b6f3-344d-11e9-a414-719c6709cf3e",
	},
]


let books = [
	{
		title: 'Clean Code',
		published: 2008,
		author: 'Robert Martin',
		id: "afa5b6f4-344d-11e9-a414-719c6709cf3e",
		genres: ['refactoring']
	},
	{
		title: 'Agile software development',
		published: 2002,
		author: 'Robert Martin',
		id: "afa5b6f5-344d-11e9-a414-719c6709cf3e",
		genres: ['agile', 'patterns', 'design']
	},
	{
		title: 'Refactoring, edition 2',
		published: 2018,
		author: 'Martin Fowler',
		id: "afa5de00-344d-11e9-a414-719c6709cf3e",
		genres: ['refactoring']
	},
	{
		title: 'Refactoring to patterns',
		published: 2008,
		author: 'Joshua Kerievsky',
		id: "afa5de01-344d-11e9-a414-719c6709cf3e",
		genres: ['refactoring', 'patterns']
	},
	{
		title: 'Practical Object-Oriented Design, An Agile Primer Using Ruby',
		published: 2012,
		author: 'Sandi Metz',
		id: "afa5de02-344d-11e9-a414-719c6709cf3e",
		genres: ['refactoring', 'design']
	},
	{
		title: 'Crime and punishment',
		published: 1866,
		author: 'Fyodor Dostoevsky',
		id: "afa5de03-344d-11e9-a414-719c6709cf3e",
		genres: ['classic', 'crime']
	},
	{
		title: 'The Demon ',
		published: 1872,
		author: 'Fyodor Dostoevsky',
		id: "afa5de04-344d-11e9-a414-719c6709cf3e",
		genres: ['classic', 'revolution']
	},

]


const typeDefs = `
enum YesNo {  YES  NO}
  type User {
    username: String!
    favoriteGenre: String!
    id: ID!
}

  type Token {
    value: String!
}

	type Book {
		title: String!
		published:Int!
		author: Author!
		id: ID!
		genres:[String!]!  
}
type Author {
		name:String!
		id: ID!
		born: Int
		bookCount: Int 
		books: [Book!]
}
  type Query {
    bookCount: Int!
		authorCount: Int!
		allBooks(author: String, genre: String):[Book!]!
		allAuthors: [Author!]!
		findAuthor(name: String!): Author
		findBook(title: String!): Book
    me: User
  }
	
type Mutation {
  addBook(
    title: String!
		published:Int!
		author: String!
		genres:[String!]!
  ): Book
editAuthor(
    name: String! 
    setBornTo: Int!
  ): Author
createUser(
    username: String!
    favoriteGenre: String!
  ): User
  login(
    username: String!
    password: String!
  ): Token
}
`

const resolvers = {
	Query: {
		bookCount: async () => await Book.collection.countDocuments(),
		authorCount: async () => await Author.collection.countDocuments(),

		allBooks: async (root, args) => {
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
			const books = await Book.find(query).populate('author')
			// Map over the books and fetch the additional author info
			const booksWithAuthorInfo = books.map(async (book) => {
				const author = await Author.findById(book.author)
				const authorBooks = await Book.find({ author: author._id })
				const bookCount = authorBooks.length
				return {
					...book.toObject(),
					author: {
						...author.toObject(),
						bookCount,
						books: authorBooks,
					}

				}
			})
			//console.log(book)

			return Promise.all(booksWithAuthorInfo)
		},

		allAuthors: async () => {
			const authors = await Author.find({})

			const authorPromises = authors.map(async (author) => {

				const authorBooks = await Book.find({ author: author._id })
				const bookCount = authorBooks.length
				return {
					...author.toObject(), // toObject() is for converting Moongoose specific document represantation into plain JS objects, without it we would have not an author info at all
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
				...author.toObject(),
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
				...book.toObject(),
				author: {
					...author.toObject(),
					bookCount,
					books: authorBooks,
				}
				//despite that findOne returns plain JavaScript object, when we return object and spreading a book, we need to use toObject() 
			}
		},

		me: (root, args, context) => {
			return context.currentUser
		}
	},

	Mutation: {
		addBook: async (root, args, context) => {
			if (args.title.length < 5) {
				throw new GraphQLError('Book title must be at least 3 characters long')
			}

			if (args.author.length < 4) {
				throw new GraphQLError('Author name must be at least 3 characters long')
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
				...author.toObject(),
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

const server = new ApolloServer({
	typeDefs,
	resolvers,
})

startStandaloneServer(server, {
	listen: { port: 4000 },
	context: async ({ req, res }) => {
		const auth = req ? req.headers.authorization : null
		if (auth && auth.toLowerCase().startsWith('bearer ')) {
			const decodedToken = jwt.verify(auth.substring(7), process.env.JWT_SECRET)
			const currentUser = await User.findById(decodedToken.id)
			return { currentUser }
		}
	},
}).then(({ url }) => {
	console.log(`Server ready at ${url}`)
})