const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const slug = require('slugs');


const storeSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    required: 'Please enter a store name'
  },
  slug: String,
  description: {
    type: String,
    trim: true
  },
  tags: [String],
  created: {
    type: Date,
    default: Date.now
  },
  location: {
    type: {
      type: String,
      default: 'Point'
    },
    coordinates: [{
      type: Number,
      required: 'You must supply coordinates!'
    }],
    address: {
      type: String,
      require: 'You must supply an address'
    }
  },
  photo: String,
  author: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: 'You must supply an author'
  }
}, {
  // optional - virtual won't display in log unless specifically called. not an issue
  toJSON: {virtuals: true },
  toObject: {virtuals: true}
});

// Define our indexes
storeSchema.index({
  name: 'text',
  description: 'text'
});

storeSchema.index({
  location: '2dsphere'
});

storeSchema.pre('save', async function (next) {
  if (!this.isModified('name')) {
    next(); // skip it
    return; // stop function from runnign
  }

  this.slug = slug(this.name);
  // find other stores that match the same name and add a number
  const slugRegEx = new RegExp(`^(${this.slug})((-[0-9]*$)?)$`, 'i');
  const storesWithSlug = await this.constructor.find({
    slug: slugRegEx
  });
  if (storesWithSlug.length) {
    this.slug = `${this.slug}-${storesWithSlug.length + 1}`;
  }
  next();

});

storeSchema.statics.getTagsList = function () {
  return this.aggregate([{
      $unwind: '$tags'
    },
    {
      $group: {
        _id: '$tags',
        count: {
          $sum: 1
        }
      }
    }, {
      $sort: {
        count: -1
      }
    }
  ]);
}

storeSchema.statics.getTopStores = function() {
  return this.aggregate([
    // lookup stores and populate their reviews
    { $lookup: {from: 'reviews', localField: '_id', foreignField: 'store', as: 'reviews' }},
    // filter for only items taht have 2 or more reviews
    //  'reviews.1' is mongo way of doing index
    { $match: { 'reviews.1': { $exists: true } }},
    // Add the average reviews field
    { $project: {
      photo: '$$ROOT.photo',
      name: '$$ROOT.name',
      reviews: '$$ROOT.reviews',
      slug: '$$ROOT.slug',
      averageRating: { $avg: '$reviews.rating'}
    }},
    // sort it by our new field, highest reviews first
    { $sort: { averageRating: -1 }},
    // limit to 10 at most
    { $limit: 10 }
  ]);
}

storeSchema.virtual('reviews', {
  ref: 'Review', // what model to link?
  localField: '_id', // which field on the store?
  foreignField: 'store' // which field on the Review?
});

function autopopulate(next) {
  this.populate('reviews');
  next();
}

storeSchema.pre('find', autopopulate);
storeSchema.pre('findOne', autopopulate);

module.exports = mongoose.model('Store', storeSchema);